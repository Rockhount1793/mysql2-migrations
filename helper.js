import mysql from "mysql2/promise"
import colors from "colors"
import { argv } from "node:process"
import fs from 'node:fs/promises'
import path from "node:path"
import { pathToFileURL } from "node:url"

const pathRoot =  path.normalize(path.dirname(process.argv[1]))
const relative_path = path.join(pathRoot,"migrations")
let max_count = 999999

let objectConn = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password:'password',
    database: 'test',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
}

let _config = {
    "name_app":"",
    "table":"",
    "migrations_types":[],
    "show_query":false,
    "cb":()=>{}
}

const makeaDir = async()=>{
    const dirs = await fs.opendir(relative_path).catch((err)=>{
        console.error("Directory no found",err)
    })
    if(!dirs){
        try {
            await fs.mkdir(relative_path,{recursive:true}).catch((err)=>{console.error(err)})
            return {"status":true,"message":"Directory created!"}
        } catch (error) {
            return {"status":false,"error":error}
        }
    }else{
        return {"status":true,"dirs":dirs}
    }
}

const __query = async(config)=>{
    objectConn.host = config.host
    objectConn.user = config.user
    objectConn.database = config.database
    objectConn.password = config.password
    objectConn.port = config.port
    _config = config
    const makedir = await makeaDir()
    if(!makedir.status){ return makedir }
    const result = await run_query("CREATE TABLE IF NOT EXISTS `" +_config.table+ "` (`timestamp` varchar(254) NOT NULL UNIQUE)")
    if(result.status){ return await handle(result) }
    return result
}

const run_query = async(query)=>{
    const pool = mysql.createPool(objectConn)
    const conn = await pool.getConnection().catch((err)=> {return {"error":err}})
    if(conn.error){ return conn }
    const result = await conn.query(query).then(([rows,fields])=>{
       return {"status":true,rows,fields}
    })
    .catch((err)=>{ return {"error": err} })
    .finally(()=> conn.release())
    return result
}

const sortFilesNames = (files_names)=>{
    return files_names.sort((a,b)=>{ return (a.timestamp - b.timestamp)}).slice(0,max_count)
}

const execute_query = async (files_names,type)=>{

    const sort_files_names = sortFilesNames(files_names)

    if (sort_files_names.length){
        const file_name = sort_files_names.shift()["file_name"]
        const file = await import(pathToFileURL(path.join(relative_path,file_name)))
        const queries = file.default
        const description = MessageConsoleAction(queries,type,file_name)
        const timestamp_val = file_name.split("_",1)[0]

        if(typeof (queries[type]) == "string"){

            if(!queries[type].length){
                MessageConsoleQueryEmpty(type,description)
                await updateRecords(type,timestamp_val)
                return await execute_query(sort_files_names,type)
            }else{                
                const result = await run_query(queries[type])
                if(result.status){
                    await updateRecords(type,timestamp_val)
                    return await execute_query(sort_files_names,type)
                }else{
                    console.error(colors.bgRed(colors.bgMagenta(_config.name_app)+ " Failed Query! "+type.toUpperCase()+", message: "+colors.bgYellow(result.error.sqlMessage)))
                    return {"status":false,"error":result.error.sqlMessage}
                }
            }

        }else{
            MessageConsoleQueryError(type,description)
            return {"status":false,"error":"Failed Query: "+type.toUpperCase()+", Query type not supported!"}
        }
    
    }else{
        console.info(colors.bgMagenta(_config.name_app)+colors.bgCyan(" Info: ")+colors.bgYellow(" No more querys "+type.toUpperCase()+" to running! "))
        return {"status":true, "message":"No more querys "+type.toUpperCase()+" to running!"}
    }
}

const updateRecords = async(type,timestamp_val)=>{
    let query = ""
    if(type==="up"){
        query = "INSERT INTO "+_config.table+" (`timestamp`) VALUES ('"+timestamp_val+"')"
    }else if(type==='down'){
        query = "DELETE FROM "+_config.table+" WHERE `timestamp` = '"+timestamp_val+"'"
    }
    return await run_query(query)
}

const validate_file_name = (file_name)=>{
    let patt = new RegExp(/^[0-9a-zA-Z-_]+$/)
    return {"status":patt.test(file_name),"error":" Migration file name can contain alphabets, numbers, hyphen or underscore!"}
}

const readFolder = async()=>{
    return await fs.readdir(relative_path,{encoding:"utf-8",recursive:false,whitFilesTypes:false},(err,files)=>{if(err){ throw err }})
}

const add_migration = async ()=>{
    const file_name = (Date.now()+"_"+argv[3]+".js").toString()
    const file_path = path.join(relative_path,file_name)
    const content = "export default "+JSON.stringify({description:"description of migration",up:"",down:""},null,4)
    try {
        await fs.writeFile(file_path,content,"utf-8")
        return {"status":true,"file_name":file_name}
    } catch(err){
        return {"status":false,"error":err}
    }
}

const up_migrations = async()=>{
    const result = await run_query("SELECT timestamp FROM "+_config.table+" ORDER BY timestamp DESC LIMIT 1")
    const files_names = []
    let max_timestamp = 0
    if(result.status && result.rows.length){ max_timestamp = result.rows[0].timestamp }
    const files = await readFolder()
    files.forEach((file)=>{
        const timestamp_split = file.split("_",1)
        if(timestamp_split.length){
            const timestamp = parseInt(timestamp_split[0])
            if(Number.isInteger(timestamp) && timestamp > max_timestamp){
                files_names.push({"timestamp":timestamp,"file_name":file})
            }
        } else{
            throw new Error("Invalid file "+file)
        }
    })
    return await execute_query(files_names,"up")
}

const  up_migrations_all = async()=>{
    const result  = await run_query("SELECT timestamp FROM " +_config.table)
    const files_names = []
    let timestamps = result.rows.map(r => parseInt(r.timestamp))
    const files = await readFolder()
    files.forEach((file)=>{
        let timestamp_split = file.split("_",1)
        if(timestamp_split.length){
            let timestamp = parseInt(timestamp_split[0])
            if(Number.isInteger(timestamp) && !timestamps.includes(timestamp)){
                files_names.push({"timestamp":timestamp,"file_name":file})
            }
        }else{
            throw new Error("Invalid file "+file)
        }
    })
    return await execute_query(files_names,"up")
}

const down_migrations = async()=>{
    const results = await run_query("SELECT timestamp FROM "+_config.table+" ORDER BY timestamp DESC LIMIT " + max_count)
    let files_names = []
    let temp_timestamps = results.rows.map((ele)=>{return ele.timestamp})
    const files = await readFolder()
    files.forEach((file)=>{
        let timestamp = file.split("_", 1)[0]
        if(temp_timestamps.indexOf(timestamp) > -1){
            files_names.push({"timestamp":timestamp,"file_name":file})
        }
    })
    return await execute_query(files_names,"down")
}

const run_migration_directly = async()=>{
    const file_name=argv[3]
    const type=argv[4]
    const file_data = await import(pathToFileURL(path.join(relative_path,file_name)))
    const queries = file_data.default
    const description = MessageConsoleAction(queries,type,file_name)
    
    if(typeof (queries[type]) == "string"){

        if(!queries[type].length){
            MessageConsoleQueryEmpty(type,description)
        }else{                
            const result = await run_query(queries[type])
            if(!result.status){
                console.error(colors.bgRed(colors.bgMagenta(_config.name_app)+ " Failed Query! "+type.toUpperCase()+", message: "+colors.bgYellow(result.error.sqlMessage)))
                return {"status":false,"error":result.error.sqlMessage}
            }else{
                return {"status":true,"message":"Direct query executed successfully!"}
            }
        }

    }else{
        MessageConsoleQueryError(type,description)
        return {"status":false,"error":"Failed Query: "+type.toUpperCase()+", Query type not supported!"}
    }

}

const MessageConsoleAction = (queries,type,file_name)=>{
    const description = queries["description"] ?? file_name
    let message_query = " no show query "
    if(_config.show_query){ message_query = queries[type] }
    console.info(colors.bgMagenta(_config.name_app)+colors.bgGreen(" Dispatch: ")+colors.bgBlue(" Type: " +type.toUpperCase())+colors.bgGreen(" Query: ")+colors.bgCyan(message_query)+colors.bgGreen(" Description: ")+colors.bgCyan(description))
    return description
}

const MessageConsoleQueryEmpty = (type,description)=>{ 
    console.info(colors.bgMagenta(_config.name_app)+colors.bgRed(" Warning: ")+colors.bgYellow(" Query type "+type.toUpperCase()+" is empty! ")+colors.bgGreen(" Description: ")+colors.bgCyan(description))    
}

const MessageConsoleQueryError = (type,description)=>{
    console.error(colors.bgMagenta(_config.name_app)+colors.bgRed(" Warning: Failed Query! "+type.toUpperCase()+", message: The query should be of text type and contain up and down properties in file to migrate!")+colors.bgGreen(" Description: ")+colors.bgCyan(description))
    console.error(colors.bgMagenta(_config.name_app)+colors.bgRed(" Warning: Fix this file and retry again!"))
}

const handle = async()=>{
    if(argv[2] == 'create' && argv.length == 4){
        const validateFileName =  validate_file_name(argv[3])
        if(validateFileName.status){ 
            const result = await add_migration()
            if(result.status){
                console.info(colors.bgMagenta(" >> File Migration: "+colors.bgCyan(result.file_name)+" Path: "+colors.bgGreen(relative_path)+" << "))
                _config.cb(" >> Create: << ")
            }else{
                _config.cb(" >> Create: "+colors.bgRed("Failed! "+result.error)+" << ")
            }
            return result
        } else{
            console.error(colors.bgRed(colors.bgMagenta(_config.name_app)+ validateFileName.error))
            _config.cb(" >> Create: << ")
            return validateFileName
        }
    }
    if(argv.length == 3){
        
        if(argv[2] == "up"){
            max_count = 1
            const result = await up_migrations()
            _config.cb(" >> MIGRATE << ")
            return result
        }
        
        if(argv[2] == "down"){
            max_count = 1
            const result = down_migrations()
            _config.cb(" >> ROLLBACK << ")
            return result
        }
        
        if(argv[2] == "migrate"){
            const result = await up_migrations_all()
            _config.cb(" >> MIGRATE ALL << ")
            return result
        }
        
        if(argv[2] == "refresh"){
            const resultdown = await down_migrations()
            const resultup = await up_migrations()
            _config.cb(" >> REFRESH << ")
            return {"down":resultdown,"up":resultup}
        }
    }
    
    if (argv[2] && argv[2] == 'run' && argv.length == 5){
        if(_config.migrations_types.includes(argv[4])){
            const result = await run_migration_directly()
            _config.cb(" >> DIRECT STRING QUERY << ")
            return result
        }else{
            console.error(colors.bgMagenta(_config.name_app)+colors.bgRed(" Failed direct Query: Parameter up or down missed >>"))
            return {"status":false,"error":"Failed direct Query: Parameter up or down missed >>"}
        }
    }
    console.error(colors.bgMagenta(_config.name_app)+colors.bgRed(" Failed command! "))
    return {"status":false,"error":"Invalid command!"}
}

export default __query