import { argv } from 'node:process'
import fs from "fs"
import colors from 'colors'

let MigrationMap = new WeakMap()

const Migration ={

    'init': class Context {

        constructor(){

            MigrationMap.set(this,{
                'name_app':'Sabueso ',
                'table' : '',
                'migrations_folder':'',
                'root_path':'',
                'migrations_types':['up', 'down'],
                'conn':{},
                'cb':function(string){
                    const message = string ? string : ' ' 
                    console.info( colors.bgCyan(colors.bgMagenta("Sabueso ")+" Command "+colors.bgMagenta(message)+" Completed! ") )
                }
            })

        }

        // ################ GET

        get name_app(){
            return MigrationMap.get(this).name_app
        }

        get name_table_migrations(){
            return MigrationMap.get(this).table
        }

        get migrations_folder(){
            return MigrationMap.get(this).migrations_folder
        }

        get root_path(){
            return MigrationMap.get(this).root_path
        }

        get conn(){
            return MigrationMap.get(this).conn
        }

        get migrations_types(){
            return MigrationMap.get(this).migrations_types
        }

        get cb(){
            return MigrationMap.get(this).cb
        }

        // ############### SET

        set name_table_migrations(name){
            MigrationMap.get(this).table = name
        }

        set migrations_folder(name){
            MigrationMap.get(this).migrations_folder = name
        }

        set conn(conn){
            MigrationMap.get(this).conn = conn
        }

        set cb(cb){
            MigrationMap.get(this).cb = cb
        }

        set root_path(root_path){
            MigrationMap.get(this).root_path = root_path
        }

        start = function(){

            const config = {
                'name_app': this.name_app,
                'table' : this.name_table_migrations,
                'migrations_path':this.migrations_folder,
                'root_path':this.root_path,
                'migrations_types':this.migrations_types,
                'conn':this.conn,
                'cb':this.cb
            }

            __query(config)
        }

    }

}

export default Migration 

function __query(config){
    
    
    async function migration(cb) {

        run_query("CREATE TABLE IF NOT EXISTS `" + config.table + "` (`timestamp` varchar(254) NOT NULL UNIQUE)", function (res) {
            handle(cb)
        })

    }

    migration(config.cb)

    function run_query( query, cb){
        
        config.conn.getConnection(function(err, connection){

            if (err){
                throw err
            }

            connection.query(query, function (error, results, fields){

                connection.release()

                cb(error,results)

            })

        })

        
    }

    //OK
    async function execute_query(final_file_paths, type, cb){

        if (final_file_paths.length){

            var file_name = final_file_paths.shift()['file_path']

            var current_file_path = '../../'+config.root_path + config.migrations_path + "/" + file_name

            const file = await import(current_file_path)

            const queries = file.default

            console.info( colors.bgGreen( colors.bgMagenta(config.name_app)+" Dispatch: " + " Type: " + type.toUpperCase() + " Query: " +queries[type]))

            var timestamp_val = file_name.split("_", 1)[0]

            if (typeof (queries[type]) == 'string') {

                run_query(queries[type], function (err,res) {

                    const result = res ?? false
                    const error = err ?? false
                   
                    if(result){
                        updateRecords(type, timestamp_val, function () {
                            execute_query(final_file_paths, type,cb)
                        })
                    }else{
                        console.log(error)
                        cb()
                        console.info(colors.bgRed(colors.bgMagenta(config.name_app)+ " Failed Query! " + type.toUpperCase()+' '))
                    }

                })

            }
            
            if (typeof (queries[type]) == 'function') {

                queries[type](config.conn,function (err,res) {

                    const result = res ?? false
                    const error = err ?? false

                    if(result){
                        updateRecords(type, timestamp_val, function () {
                            execute_query(final_file_paths, type,cb)
                        })
                    }else{
                        console.log(error)
                        cb()
                        console.info(colors.bgRed(colors.bgMagenta(config.name_app)+ " Failed Query! " + type.toUpperCase()+' '))
                        
                    }
                    
                })
            }


        } else {
            console.info(colors.bgYellow(colors.bgMagenta(config.name_app)+ " No more querys " + type.toUpperCase() + " to running! "))
            cb()
        }

    }

    function updateRecords(type, timestamp_val, cb) {

        var query = ''

        if (type == 'up') {

            query = "INSERT INTO " + config.table + " (`timestamp`) VALUES ('" + timestamp_val + "')"

        } else if(type == 'down'){

            query = "DELETE FROM " + config.table + " WHERE `timestamp` = '" + timestamp_val + "'"

        }

        run_query(query, function (err,res) {
            cb(err,res)
        })

    }

    function validate_file_name(file_name) {

        var patt = /^[0-9a-zA-Z-_]+$/
        return patt.test(file_name)

    }

    function readFolder(cb){
    
        var relative_path = './'+config.root_path + config.migrations_path
    
        fs.readdir(relative_path, function (err, files) {
        
            if (err) {
                throw err
            }
        
            cb(files)
        
        })
    }

    //OK
    function add_migration(argv, cb) {
    
        readFolder(function (files) {
    
            let file_name = Date.now() + "_" + argv[3]
            let file_path = config.root_path + config.migrations_path + '/' + file_name + '.js'
    
            let sql_json = {
                up   : "",
                down : ""
            }
    
            let content = 'export default ' + JSON.stringify(sql_json, null, 4)
    
            fs.writeFile(file_path, content, 'utf-8', function (err) {
    
                if(err){
                    throw err
                }
    
                console.info( colors.bgGreen(colors.bgMagenta(config.name_app) + " Added file migration: " + file_name+' ' ))
    
                cb()
    
            })
    
        })
    
    }
    
    //OK
    function up_migrations(max_count,cb) {
    
        run_query("SELECT timestamp FROM " + config.table + " ORDER BY timestamp DESC LIMIT 1", function (error, results) {
    
            var file_paths = []
            var max_timestamp = 0
    
            if (results.length) {
                max_timestamp = results[0].timestamp
            }
    
            readFolder(function (files) {
    
                files.forEach(function (file) {
    
                    var timestamp_split = file.split("_", 1)
    
                    if (timestamp_split.length){
    
                        var timestamp = parseInt(timestamp_split[0])
    
                        if (Number.isInteger(timestamp) && timestamp.toString().length == 13 && timestamp > max_timestamp) {
                            file_paths.push({ 'timestamp' : timestamp, 'file_path' : file})
                        }
    
                    } else {
                        throw new Error('Invalid file ' + file)
                    }
    
                })
    
                var final_file_paths = file_paths.sort(function (a, b) { return (a.timestamp - b.timestamp) }).slice(0, max_count)
    
                execute_query( final_file_paths, 'up',cb)
    
            })
    
        })

    }
    
    function up_migrations_all(max_count,cb) {
    
        run_query("SELECT timestamp FROM " + config.table, function (error,results) {
    
            var file_paths = []
            var timestamps = results.map(r => parseInt(r.timestamp))
    
            readFolder(function (files) {
    
                files.forEach(function (file) {
    
                    var timestamp_split = file.split("_", 1)
    
                    if (timestamp_split.length) {
    
                        var timestamp = parseInt(timestamp_split[0])
    
                        if (Number.isInteger(timestamp) && timestamp.toString().length == 13 && !timestamps.includes(timestamp)) {
                            file_paths.push({ 'timestamp': timestamp, 'file_path': file })
                        }
    
                    } else {
                        throw new Error('Invalid file ' + file)
                    }
                })
    
                var final_file_paths = file_paths.sort(function(a, b) { return (a.timestamp - b.timestamp)}).slice(0, max_count)
                
                execute_query(final_file_paths, 'up',cb)
            
            })
            
        })
    }
    
    //OK
    function down_migrations(max_count,cb) {
    
        run_query("SELECT timestamp FROM " + config.table + " ORDER BY timestamp DESC LIMIT " + max_count, function (error, results) {
    
            var file_paths = []
    
            var temp_timestamps = results.map(function (ele) {
                return ele.timestamp
            })
    
            readFolder(function (files) {
    
                files.forEach(function (file) {
    
                    var timestamp = file.split("_", 1)[0]
    
                    if (temp_timestamps.indexOf(timestamp) > -1) {
                        file_paths.push({ 'timestamp' : timestamp, file_path : file})
                    }
    
                })
    
                var final_file_paths = file_paths.sort(function(a, b) { return (b.timestamp - a.timestamp)}).slice(0, max_count)
                execute_query(final_file_paths, 'down',cb)
    
            })
    
        })


    }
    
    //OK
    async function run_migration_directly(){

        const file = argv[3]
        const type = argv[4]

        const file_data = await import('../../'+config.root_path + config.migrations_path + "/" + file)
    
        const query = file_data.default
        
        if (typeof (query[type]) == 'string') {

            console.info( colors.bgBlue(colors.bgMagenta(config.name_app) +' Direct: Query String! ') )
            
            console.info(`Direct: ${type.toUpperCase()} Query: "${query[type].toString()}"`)

            run_query(query[type], function(err,res){

                const result = res ?? false
                const error = err ?? false
               
                if(result){
                    console.info(colors.bgBlue(colors.bgMagenta(config.name_app)+ " Direct: Query String! Type: " + type.toUpperCase()+' Completed! '))
                }else{
                    console.log(error)
                    console.info(colors.bgRed(colors.bgRed(config.name_app)+ " Failed Query! " + type.toUpperCase()+' '))
                }

                config.conn.end()
                config.cb(' >> DIRECT QUERY << ')

            })
           
        }
        
        if (typeof (query[type]) == 'function') {

            console.info( colors.bgBlue(colors.bgMagenta(config.name_app) +' Direct: Query Function! ') )
    
            console.info(`Direct: ${type.toUpperCase()} Function: "${query[type]}"`)

            query[type](config.conn,function(err,res){

                const result = res ?? false
                const error = err ?? false

                if(result){
                    console.info(colors.bgBlue(colors.bgMagenta(config.name_app)+ " Direct: Query String! Type: " + type.toUpperCase()+' Completed! '))
                }else{
                    console.log(error)
                    console.info(colors.bgRed(colors.bgRed(config.name_app)+ " Failed Query! " + type.toUpperCase()+' '))
                }

                config.conn.end()
                config.cb(' >> DIRECT QUERY << ')

            })
    
        }
    
    }
    
    function handle(){

        if (argv[2] == 'create' && argv.length == 4) {

            if(validate_file_name(argv[4])){

                add_migration(argv,function () {
                    config.conn.end()
                    config.cb(' >> CREATE << ')
                })

            }
            else{
                console.info(colors.bgRed(colors.bgMagenta(config.name_app)+ " File name can contain alphabets, numbers, hyphen or underscore! "))
            }

        }

        if (argv.length == 3) {

            if (argv[2] == 'up'){

                up_migrations(1,function(){
                    config.conn.end()
                    config.cb(' >> MIGRATE << ')
                })

            }
            
            if (argv[2] == 'down'){

                down_migrations(1, function (){
                    config.conn.end()
                    config.cb(' >> ROLLBACK << ')
                })

            }

            if (argv[2] == 'migrate'){

                up_migrations_all(99999,function () {
                    config.conn.end()
                    config.cb(' >> MIGRATE ALL << ')
                })

            }
            
            if(argv[2] == 'refresh') {

                down_migrations(999999, function () {

                    up_migrations(999999,function(){
                        
                        config.conn.end()
                        config.cb(' >> REFRESH << ')
                    
                    })
                    
                })

            }

        }

        if (argv[2] == 'run' && argv.length == 5) {

            if(config.migrations_types.indexOf(argv[4]) > -1){
                run_migration_directly()
            }else{
                config.conn.end()
                console.info(colors.bgRed(colors.bgMagenta(config.name_app)+ " Failed Query: Parameter UP or DOWN missed, >> " + argv[4].toUpperCase()+' !!'))
            }

        }

    }

}
        


