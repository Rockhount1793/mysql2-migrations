#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from "node:path"
import { pathToFileURL } from "node:url"
import colors from "colors"

const file_name = "migrations_config.js"
const file_package = "package.json"
const pathRoot =  path.normalize(process.cwd())
const relative_path_config = path.join(pathRoot,"mysql2-migrations")
const relative_path_migrations = path.join(relative_path_config,"migrations")
const path_config = path.join(relative_path_config,file_name)
const path_package = path.join(pathRoot,file_package)

const addFileConfig = async ()=>{
    const data = 
    "import Migration from 'mysql2-migrations'\n"+
    "\n"+
    "const db_query = new Migration()\n"+
    'db_query.database = "test"\n'+
    'db_query.user = "root"\n'+
    'db_query.password = "paswword"\n'+
    'db_query.host = "127.0.0.1"\n'+
    "db_query.port = 3306\n"+
    'db_query.name_table_migrations = "table_migrations_app"\n'+
    "db_query.show_query = false\n"+
    "db_query.show_depuration = false\n"+
    "db_query.start()\n";
    
    try {
        await fs.writeFile(path_config,data,"utf-8")
        return {"status":true,"file_name":file_name}
    } catch(err){
        return {"status":false,"error":err}
    }
}

const makeaDirConfig = async(_relative_path)=>{
    try {
        await fs.mkdir(_relative_path,{recursive:true}).catch((err)=>{console.error(err)})
        return {"status":true,"message":"Config Directory created!"}
    } catch (error) {
        return {"status":false,"error":error}
    }
}

const addScripstToConfiguration = async()=>{
    const configuration = await fs.readFile(pathToFileURL(path.join(pathRoot,"package.json"),"utf-8"))
    const data = JSON.parse(configuration.toString('utf-8'))
    let scripts = {}
    const new_scripts = {
        "db_create": "node mysql2-migrations/migrations_config.js create",
        "db_refresh": "node mysql2-migrations/migrations_config.js refresh",
        "db_migrate_all": "node mysql2-migrations/migrations_config.js migrate",
        "db_migrate": "node mysql2-migrations/migrations_config.js up",
        "db_rollback": "node mysql2-migrations/migrations_config.js down"
    }

    if(data.scripts){
        scripts = {
            ...data.scripts,
            ...new_scripts
        }
    }else{
        scripts = new_scripts
    }   

    const newData = JSON.stringify({...data,"scripts":{ ...scripts }},null,2)
    
    try{
        await fs.writeFile(path_package,newData,"utf-8")
        return {"status":true,"file_name":file_package}
    } catch(err){
        return {"status":false,"error":err}
    }
}

const init = async ()=>{
    
    console.info(colors.bgMagenta(" init mysql2-migrations "))    
    
    console.info(colors.bgGreen(" Creating config directory.."))
    const makeaDirResultConfig = await makeaDirConfig(relative_path_config)
    if(makeaDirResultConfig.status){
        console.info(colors.bgCyan(" Created config directory! OK"))
    }else{
        console.error(colors.bgRed(" Error: "+makeaDirResultConfig.error))
    }

    console.info(colors.bgGreen(" Creating migrations directory.."))
    const makeaDirResultMigrations = await makeaDirConfig(relative_path_migrations)
    if(makeaDirResultMigrations.status){
        console.info( colors.bgCyan(" Created migrations directory! OK"))
    }else{
        console.error(colors.bgRed(" Error: "+makeaDirResultMigrations.error))
    }

    
    console.info(colors.bgGreen(" Add scripts commands to package.."))
    const addScriptsResult = await addScripstToConfiguration()
    if(addScriptsResult.status){
        console.info(colors.bgCyan(" Scripts commands added to package.json! OK"))
    }else{
        console.error(colors.bgRed(" Error: "+addScriptsResult.error))
    }

    console.info( colors.bgGreen(" Creating file config.."))
    if(makeaDirResultConfig.status){
        const resultAddFileConfig = await addFileConfig()
        if(resultAddFileConfig.status){
            console.info(colors.bgCyan(" Config file created! OK, path: "+colors.bgBlue(path_config)))
        } else {
            console.error(colors.bgRed(" Error: "+resultAddFileConfig.error))
        }
    }else{
        console.error(colors.bgRed(" Error:  Config directory not found!"))
    }

    process.exit(0)
}
init()
