import { argv } from "node:process"
import fs from "fs"
import colors from "colors"
import path from "node:path"
import { pathToFileURL } from "node:url"
let MigrationMap = new WeakMap()
const pathRoot =  path.dirname(process.argv[1])
export default class Migration {
    constructor(){
        MigrationMap.set(this,{
            "name_app":"Sabueso ",
            "table":"table_migrations_app",
            "migrations_types":["up","down"],
            "show_query":false,
            "conn":{},
            "cb":(string)=>{
                const message = string ? string : ' ' 
                console.info(colors.bgCyan(colors.bgMagenta("Sabueso ")+" Command "+colors.bgMagenta(message)+" Completed! "))
                process.exit(0)
            }
        })
    }
    // ################ GET
    get name_app(){return MigrationMap.get(this).name_app}
    get name_table_migrations(){return MigrationMap.get(this).table}
    get migrations_types(){return MigrationMap.get(this).migrations_types}
    get show_query(){return MigrationMap.get(this).show_query}
    get conn(){return MigrationMap.get(this).conn}
    get cb(){return MigrationMap.get(this).cb}
    // ############### SET
    set name_app(name){ MigrationMap.get(this).name_app = name}
    set show_query(boolean){MigrationMap.get(this).show_query = boolean}
    set name_table_migrations(name){MigrationMap.get(this).table = name}
    set conn(conn){MigrationMap.get(this).conn = conn}
    start=()=>{this.__query({"name_app":this.name_app,"table":this.name_table_migrations,"migrations_types":this.migrations_types,"show_query":this.show_query,"conn":this.conn,"cb":this.cb})}
    // ############### RUN
    __query(config){
        async function migration(){run_query("CREATE TABLE IF NOT EXISTS `" +config.table+ "` (`timestamp` varchar(254) NOT NULL UNIQUE)",(err,res)=>{handle()})}
        migration()
        function run_query(query,cb){config.conn.getConnection((err,connection)=>{if(err){throw err}connection.query(query,(error,results,fields)=>{connection.release();cb(error,results)})})}
        async function execute_query(final_file_paths,type,cb){
            if (final_file_paths.length){
                let file_name = final_file_paths.shift()["file_path"]
                let current_file_path =  pathToFileURL(pathRoot+"\\"+"migrations"+"\\"+file_name)
                const file = await import(current_file_path);const queries = file.default;const nameTable = queries["name"] ?? "Table: "+Number(final_file_paths.length+1)
                if(config.show_query){console.info(colors.bgMagenta(config.name_app)+" "+colors.bgGreen(" Dispatch: ")+" "+colors.bgBlue(" Type: " +type.toUpperCase())+" "+colors.bgCyan(" Name: "+nameTable)+" "+colors.bgGreen(" Query: " +queries[type]))}else{console.info(colors.bgMagenta(config.name_app)+" "+colors.bgGreen(" Dispatch: ")+" "+colors.bgBlue(" Type: " +type.toUpperCase())+" "+colors.bgGreen(" Query: "+typeof queries[type])+" "+colors.bgCyan(" Name: "+nameTable))}
                let timestamp_val = file_name.split("_",1)[0]
                if(typeof (queries[type]) == "string"){run_query(queries[type],(err,res)=>{const result = res ?? false;const error = err ?? false;if(result){updateRecords(type,timestamp_val,()=>{execute_query(final_file_paths,type,cb)})}else{console.info(error);cb();console.info(colors.bgRed(colors.bgMagenta(config.name_app)+ " Failed Query! "+type.toUpperCase()+" "))}})}
                if(typeof (queries[type]) == "function"){queries[type](config.conn,(err,res)=>{const result = res ?? false;const error = err ?? false;if(result){updateRecords(type,timestamp_val,()=>{execute_query(final_file_paths,type,cb)})}else{console.log(error);cb();console.info(colors.bgRed(colors.bgMagenta(config.name_app)+ " Failed Query! "+type.toUpperCase()+" "))}})}
            }else{console.info(colors.bgYellow(colors.bgMagenta(config.name_app)+" No more querys "+type.toUpperCase()+" to running! "));cb()}
        }
        function updateRecords(type,timestamp_val,cb){
            let query = ""
            if(type=="up"){query = "INSERT INTO "+config.table+" (`timestamp`) VALUES ('"+timestamp_val+"')"}else if(type=='down'){query = "DELETE FROM "+config.table+" WHERE `timestamp` = '"+timestamp_val+"'"}
            run_query(query,(err,res)=>{cb(err,res)})
        }
        function validate_file_name(file_name){
            let patt = /^[0-9a-zA-Z-_]+$/
            return patt.test(file_name)
        }
        function readFolder(cb){
            const relative_path = pathRoot+"\\"+"migrations"
            fs.readdir(relative_path, function(err,files){if(err){throw err};cb(files)})
        }
        function add_migration(argv,cb){
            readFolder((files)=>{
                const file_name = Date.now()+"_"+argv[3]
                const file_path = pathRoot+"\\"+'migrations'+"\\"+file_name+".js"
                const sql_json = {
                    name:"Name Table",
                    up   : "",
                    down : ""
                }
                const content = "export default " +JSON.stringify(sql_json,null,4)
                fs.writeFile(file_path, content,"utf-8",(err)=>{if(err){throw err};console.info( colors.bgGreen(colors.bgMagenta(config.name_app)+" Added file migration: "+file_name));cb()})
            })
        }
        function up_migrations(max_count,cb){
            run_query("SELECT timestamp FROM " +config.table+" ORDER BY timestamp DESC LIMIT 1",(error,results)=>{
                let file_paths = [],max_timestamp = 0
                if(results.length){max_timestamp = results[0].timestamp}
                readFolder((files)=>{
                    files.forEach((file)=>{let timestamp_split = file.split("_", 1);if(timestamp_split.length){let timestamp = parseInt(timestamp_split[0]);if(Number.isInteger(timestamp) && timestamp.toString().length == 13 && timestamp > max_timestamp){file_paths.push({'timestamp':timestamp,'file_path':file})}} else{throw new Error("Invalid file "+file)}})
                    let final_file_paths = file_paths.sort((a,b)=>{ return (a.timestamp - b.timestamp)}).slice(0,max_count)
                    execute_query(final_file_paths,"up",cb)
                })
            })
        }
        function up_migrations_all(max_count,cb){
            run_query("SELECT timestamp FROM " +config.table,(error,results)=>{
                let file_paths = [],timestamps = results.map(r => parseInt(r.timestamp))
                readFolder((files)=>{
                    files.forEach((file)=>{let timestamp_split = file.split("_", 1);if(timestamp_split.length){let timestamp = parseInt(timestamp_split[0]);if(Number.isInteger(timestamp) && timestamp.toString().length == 13 && !timestamps.includes(timestamp)){file_paths.push({"timestamp":timestamp,"file_path":file})}}else{ throw new Error("Invalid file "+file)}})
                    let final_file_paths = file_paths.sort((a, b)=>{ return (a.timestamp - b.timestamp)}).slice(0, max_count)
                    execute_query(final_file_paths,"up",cb)
                })
            })
        }
        function down_migrations(max_count,cb){
            run_query("SELECT timestamp FROM "+config.table+" ORDER BY timestamp DESC LIMIT " + max_count,(error,results)=>{
                let file_paths = []
                let temp_timestamps = results.map((ele)=>{return ele.timestamp})
                readFolder((files)=>{
                    files.forEach((file)=>{let timestamp = file.split("_", 1)[0];if(temp_timestamps.indexOf(timestamp) > -1){file_paths.push({"timestamp":timestamp,"file_path":file})}})
                    const final_file_paths = file_paths.sort((a, b)=>{ return (b.timestamp - a.timestamp)}).slice(0, max_count)
                    execute_query(final_file_paths,'down',cb)
                })
            })
        }
        async function run_migration_directly(){
            const file=argv[3],type=argv[4],file_data = await import( pathToFileURL(pathRoot+"\\"+"migrations"+"\\"+file)),query = file_data.default
            if(typeof (query[type]) == "string"){
                console.info( colors.bgBlue(colors.bgMagenta(config.name_app)+" Executing String Query! ") )
                if(config.show_query){console.info(`Direct: ${type.toUpperCase()} Query: "${query[type].toString()}"`)}
                run_query(query[type],(err,res)=>{const result = res ?? false;const error = err ?? false;if(result){console.info(colors.bgBlue(colors.bgMagenta(config.name_app)+ " Direct: String Query! - Type: " +type.toUpperCase()+" Completed! "))}else{console.log(error);console.info(colors.bgRed(colors.bgRed(config.name_app)+ " Failed String Query " + type.toUpperCase()+"! "))};config.conn.end();config.cb(" >> DIRECT STRING QUERY << ")})
            }
            if(typeof (query[type]) == "function"){
                console.info(colors.bgBlue(colors.bgMagenta(config.name_app) +" Direct: Query Function! "))
                if(config.show_query){ console.info(`Direct: ${type.toUpperCase()} Function: "${query[type]}"`)}
                query[type](config.conn,(err,res)=>{const result = res ?? false;const error = err ?? false;if(result){ console.info(colors.bgBlue(colors.bgMagenta(config.name_app)+" Direct: Function Query! - Type: " + type.toUpperCase()+" Completed! "))}else{console.log(error);console.info(colors.bgRed(colors.bgRed(config.name_app)+ " Failed Function Query " + type.toUpperCase()+'! '))};config.conn.end();config.cb(" >> DIRECT FUNCTION QUERY << ")})
            }
        }
        function handle(){
            if(argv[2] == 'create' && argv.length == 4){ if(validate_file_name(argv[4])){ add_migration(argv,()=>{config.conn.end();config.cb(' >> CREATE << ') }) } else{ console.info(colors.bgRed(colors.bgMagenta(config.name_app)+ " File name can contain alphabets, numbers, hyphen or underscore! "))}}
            if(argv.length == 3){if(argv[2] == "up"){up_migrations(1,()=>{config.conn.end();config.cb(" >> MIGRATE << ")})};if(argv[2] == "down"){down_migrations(1,()=>{config.conn.end();config.cb(" >> ROLLBACK << ")})};if(argv[2] == "migrate"){up_migrations_all(99999,()=>{config.conn.end();config.cb(" >> MIGRATE ALL << ")})};if(argv[2] == "refresh"){down_migrations(999999,()=>{up_migrations(999999,()=>{config.conn.end();config.cb(" >> REFRESH << ")})})}}
            if (argv[2] == 'run' && argv.length == 5){if(config.migrations_types.indexOf(argv[4]) > -1){run_migration_directly()}else{config.conn.end();console.info(colors.bgRed(colors.bgMagenta(config.name_app)+" Failed Query: Parameter UP or DOWN missed, >> " + argv[4].toUpperCase()+" !!"))}}
        }
    }
}
