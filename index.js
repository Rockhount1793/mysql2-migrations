
import { argv } from 'node:process'
import fs from "fs"
import colors from 'colors'
import { exec } from 'child_process'

let MigrationMap = new WeakMap()

const Migration ={

    'init': class Context {

        constructor(){

            MigrationMap.set(this,{
                'table' : '',
                'migrations_folder':'',
                'root_path':'',
                'migrations_types':['up', 'down'],
                'conn':{},
                'cb':function(){
                    console.info( colors.bgCyan(" Query Command Completed! ") )
                }
            })

        }

        // ################ GET

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

        set migrations_path(migrations_path){
            MigrationMap.get(this).migrations_path = migrations_path
        }

        set root_path(root_path){
            MigrationMap.get(this).root_path = root_path
        }

        start = function(options){

            const config = {
                'table' : this.name_table_migrations,
                'migrations_path':this.migrations_folder,
                'root_path':this.root_path,
                'migrations_types':this.migrations_types,
                'conn':this.conn,
                'cb':this.cb
            }

            __query(config, options)
        }

    }

}

export default Migration

function __query(config, options){
    
    var updateSchema = false
    var migrate_all = false
    
    async function migration(cb, options) {

        var updateSchemaIndex = argv.indexOf("--update-schema")

        if (updateSchemaIndex > -1) {
            updateSchema = true
            argv.splice(updateSchemaIndex, 1)
        }

        var migrate_index = argv.indexOf("--migrate-all")

        if (migrate_index > -1) {
            migrate_all = true
            argv.splice(migrate_index, 1)
        }

        if (options instanceof Array) {

            if (options.indexOf("--migrate-all") > -1) {
                migrate_all = true
            }

            if (options.indexOf("--update-schema") > -1) {
                updateSchema = true
            }
        }

        run_query("CREATE TABLE IF NOT EXISTS `" + config.table + "` (`timestamp` varchar(254) NOT NULL UNIQUE)", function (res) {
            handle(argv,cb)
        })

    }

    migration(config.cb,options)

    function run_query( query, cb, run){

        if (run == null) {
            run = true
        }

        if (run) {
        
            config.conn.getConnection(function(err, connection){

                if (err){
                    throw err
                }

                connection.query(query, function (error, results, fields){

                    connection.release()

                    if (error) {
                        throw error
                    }

                    cb(results)

                })

            })

        } else {

            cb({})

        }

    }

    async function execute_query(final_file_paths, type, cb, run){

        if (run == null){
            run = true
        }

        if (final_file_paths.length){

            var file_name = final_file_paths.shift()['file_path']

            var current_file_path = '../../'+config.root_path + config.migrations_path + "/" + file_name

            const file = await import(current_file_path)

            const queries = file.default

            console.info( colors.bgGreen("Run: " + run + " Type: " + type.toUpperCase() + ": " + queries[type]) )

            var timestamp_val = file_name.split("_", 1)[0]

            if (typeof (queries[type]) == 'string') {

                run_query(queries[type], function (res) {

                    updateRecords(type, timestamp_val, function () {
                        execute_query(final_file_paths, type, cb, run)
                    })

                }, run)

            } else if (typeof (queries[type]) == 'function') {

                queries[type](config.conn,function () {

                    updateRecords(type, timestamp_val, function () {
                        execute_query(final_file_paths, type, cb)
                    })

                })
            }


        } else {

            console.info(colors.bgYellow(" No more " + type.toUpperCase() + " migrations to running "))
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

        run_query(query, function (res) {
            cb()
        })

    }

    function validate_file_name(file_name) {

        var patt = /^[0-9a-zA-Z-_]+$/
    
        if (!patt.test(file_name)) {
            throw new Error("File name can contain alphabets, numbers, hyphen or underscore")
        }
    }

    function readFolder(cb){
    
        var relative_path = './'+config.root_path + config.migrations_path
    
        fs.readdir(relative_path, function (err, files) {
        
            if (err) {
                throw err
            }
        
            var schemaPath = files.indexOf("schema.sql")
        
            if (schemaPath > -1) {
                files.splice(schemaPath, 1)
            }
        
            cb(files)
        
        })
    }

    function add_migration(argv, cb) {
    
        validate_file_name(argv[4])
    
        readFolder(function (files) {
    
            var file_name = Date.now() + "_" + argv[4]
            var file_path = config.root_path + config.migrations_path + '/' + file_name + '.js'
    
            var sql_json = {
                up   : '',
                down : ''
            }
    
            if (argv.length > 5) {
                sql_json['up'] = argv[5]
            }
    
            var content = 'export default ' + JSON.stringify(sql_json, null, 4)
    
            fs.writeFile(file_path, content, 'utf-8', function (err) {
    
                if (err) {
    
                    throw err
                }
    
                console.info( colors.bgGreen(" Added file migration: " + file_name+' ' ))
    
                cb()
    
            })
    
        })
    
    }
    
    function up_migrations(max_count, cb) {
    
        run_query("SELECT timestamp FROM " + config.table + " ORDER BY timestamp DESC LIMIT 1", function (results) {
    
            var file_paths = []
            var max_timestamp = 0
    
            if (results.length) {
                max_timestamp = results[0].timestamp
            }
    
            readFolder(function (files) {
    
                files.forEach(function (file) {
    
                    var timestamp_split = file.split("_", 1)
    
                    if (timestamp_split.length) {
    
                        var timestamp = parseInt(timestamp_split[0])
    
                        if (Number.isInteger(timestamp) && timestamp.toString().length == 13 && timestamp > max_timestamp) {
                            file_paths.push({ 'timestamp' : timestamp, 'file_path' : file})
                        }
    
                    } else {
                        throw new Error('Invalid file ' + file)
                    }
    
                })
    
                var final_file_paths = file_paths.sort(function (a, b) { return (a.timestamp - b.timestamp) }).slice(0, max_count)
    
                execute_query( final_file_paths, 'up', cb)
    
            })
    
        })
    }
    
    function up_migrations_all(max_count, cb) {
    
        run_query("SELECT timestamp FROM " + config.table, function (results) {
    
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
                
                execute_query(final_file_paths, 'up', cb)
            
            })
            
        })
    }
    
    function down_migrations(max_count, cb) {
    
        run_query("SELECT timestamp FROM " + config.table + " ORDER BY timestamp DESC LIMIT " + max_count, function (results) {
    
            var file_paths = []
    
            if (results.length) {
    
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
                    execute_query(final_file_paths, 'down', cb)
    
                })
            }
    
        })
    }
    
    async function run_migration_directly(file, type, cb) {
    
        var current_file_path = config.migrations_path + "/" + file
        
        const file_data = await import('../../'+config.root_path + current_file_path)
    
        const query = file_data.default
        
        if (typeof (query[type]) == 'string') {
    
            console.info(`Direct: ${type.toUpperCase()} Query: "${query[type].toString()}"`)
            run_query(query[type], cb)
            console.info( colors.bgBlue(' Direct: Query String! ') )
    
        } else if (typeof (query[type]) == 'function') {
    
            console.info(`Direct: ${type.toUpperCase()} Function: "${query[type]}"`)
            query[type](config.conn,cb)
            console.info( colors.bgBlue(' Direct: Query Function! ') )
    
        }
    
    
    }
    
    function update_schema(cb) {
    
        var conn_config = config.conn.config.connectionConfig
        var filePath = config.root_path + config.migrations_path + '/' + 'schema.sql'
        
        fs.unlink(filePath, function () {
            
            var cmd = "mysqldump --no-data "
            if (conn_config.host) {
              cmd = cmd + " -h " + conn_config.host
            }
        
            if (conn_config.port) {
              cmd = cmd + " --port=" + conn_config.port
            }
        
            if (conn_config.user) {
              cmd = cmd + " --user=" + conn_config.user
            }
        
            if (conn_config.password) {
              cmd = cmd + " --password=" + conn_config.password
            }
        
            cmd = cmd + " " + conn_config.database
        
            exec(cmd, function (error, stdout, stderr) {
            
                fs.writeFile(filePath, stdout, function (err) {
                
                    if (err) {
                        console.log(colors.red("Could not save schema file"))
                    }
                
                    cb()
                
                })

                console.log(colors.red(error))

            })
    
        })

    }
    
    function createFromSchema(cb) {
    
        var conn_config = config.conn.config.connectionConfig
      
        var filePath = config.root_path + config.migrations_path + '/' + 'schema.sql'
      
        if (fs.existsSync(filePath)) {
    
            var cmd = "mysql "
        
            if (conn_config.host) {
            cmd = cmd + " -h " + conn_config.host
            }
    
            if (conn_config.port) {
                cmd = cmd + " --port=" + conn_config.port
            }
    
            if (conn_config.user) {
                cmd = cmd + " --user=" + conn_config.user
            }
    
            if (conn_config.password) {
                cmd = cmd + " --password=" + conn_config.password
            }
    
            cmd = cmd + " " + conn_config.database
            cmd = cmd + " < " + filePath
    
            exec(cmd, function(error, stdout, stderr) {
          
                if (error) {
                    console.log(colors.red("Could not load from Schema: " + error))
                    cb()
    
                } else {
    
                    var file_paths = []
            
                    readFolder(function (files) {
              
                        files.forEach(function (file) {
                
                            var timestamp_split = file.split("_", 1)
                            var timestamp = parseInt(timestamp_split[0])
                
                            if (timestamp_split.length) {
                                file_paths.push({ 'timestamp' : timestamp, file_path : file})
                            } else {
                                throw new Error('Invalid file ' + file)
                            }
    
                        })
    
                        var final_file_paths = file_paths.sort(function(a, b) { return (a.timestamp - b.timestamp)}).slice(0, 9999999)
              
                        execute_query(final_file_paths, 'up', cb, false)
    
                    })
    
                }
    
            })
    
        } else {
            console.log(colors.red("Schema Missing: " + filePath))
            cb()
        }
    
    }

    function handle(argv,cb) {

        if (argv.length > 2 && argv.length <= 6) {

            if (argv[2] == 'add' && (argv[3] == 'migration' || argv[3] == 'seed')) {

                add_migration(argv,function () {
                    config.conn.end()
                    cb()
                })

            } else if (argv[2] == 'up') {

                var count = null

                if (argv.length > 3) {
                    count = parseInt(argv[3]);
                } else {
                    count = 999999;
                }

                if (migrate_all) {
                    up_migrations_all(count, function () {
                        updateSchemaAndEnd()
                        cb()
                    })

                } else {

                    up_migrations(count, function () {
                        updateSchemaAndEnd()
                        cb()
                    })
                }

            } else if (argv[2] == 'down') {

                var count = null

                if (argv.length > 3) {
                    count = parseInt(argv[3])
                } else count = 1

                down_migrations(count, function () {
                    updateSchemaAndEnd()
                    cb()
                })

            } else if (argv[2] == 'refresh') {

                down_migrations(999999, function () {

                    up_migrations(999999, function () {
                        updateSchemaAndEnd()
                        cb()
                    })

                })

                
            } else if (argv[2] == 'run' && config.migrations_types.indexOf(argv[4]) > -1) {

                run_migration_directly(argv[3], argv[4], function () {
                    updateSchemaAndEnd()
                    cb()
                })

            } else if (argv[2] == 'load-from-schema') {

                createFromSchema(function () {
                   config.conn.end()
                   cb()
                })

            } else{
                throw new Error('command not found : ' + argv.join(" "))
            }

        }
    }

    function updateSchemaAndEnd() {

        if (updateSchema) {

            update_schema(function () {
                config.conn.end()
            })

        } else {
            config.conn.end()
        }
    }

}
