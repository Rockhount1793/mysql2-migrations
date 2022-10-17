
import { argv } from 'node:process'
import fs from "fs"
import colors from 'colors'
import { exec } from 'child_process'

const config = {
    'table' : 'mysql_migrations_app',
    'migrations_types' : ['up', 'down'],
    'migrations_path': './migrations',
    'root_path':'./mysql-migrations/'
}

const migrations_path = config.migrations_path
const root_path = config.root_path
const table = config.table

var migrations_types = config.migrations_types

var updateSchema = false // actualizar todo
var migrate_all = false // forzar migraciones

const queryFunctions = {
    
    'run_query': function(conn, query, cb, run){

        if (run == null) {
            run = true
        }

        if (run) {
        
            conn.getConnection(function(err, connection){

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

    },

    'execute_query': async function(conn, final_file_paths, type, cb, run){

        if (run == null){
            run = true
        }

        if (final_file_paths.length){

            var file_name = final_file_paths.shift()['file_path']

            var current_file_path = migrations_path + "/" + file_name

            const file = await import(current_file_path)

            const queries = file.default

            console.info(colors.green("Run: " + run + " Type: " + type.toUpperCase() + ": " + queries[type]))

            var timestamp_val = file_name.split("_", 1)[0]

            if (typeof (queries[type]) == 'string') {

                run_query(conn, queries[type], function (res) {

                    updateRecords(conn, type, table, timestamp_val, function () {
                        execute_query(conn, final_file_paths, type, cb, run)
                    })

                }, run)

            } else if (typeof (queries[type]) == 'function') {

                console.info(`${type.toUpperCase()} Function: "${queries[type].toString()}"`)

                queries[type](conn, function () {

                    updateRecords(conn, type, table, timestamp_val, function () {
                        execute_query(conn, final_file_paths, type, cb)
                    })
                })
            }


        } else {

            console.info(colors.blue("No more " + type.toUpperCase() + " migrations to run"))
            cb()

        }

    },

    'updateRecords': function(conn, type, table, timestamp_val, cb) {

        var query = ''

        if (type == 'up') {

            query = "INSERT INTO " + table + " (`timestamp`) VALUES ('" + timestamp_val + "')"

        } else if(type == 'down'){

            query = "DELETE FROM " + table + " WHERE `timestamp` = '" + timestamp_val + "'"

        }

        run_query(conn, query, function (res) {
            cb()
        })

    }

}

const fileFunctions = {

    'validate_file_name' : function(file_name) {

        var patt = /^[0-9a-zA-Z-_]+$/
    
        if (!patt.test(file_name)) {
            throw new Error("File name can contain alphabets, numbers, hyphen or underscore")
        }
    },
    
    'readFolder' :function(cb) {
    
        var relative_path = root_path+migrations_path
    
        fs.readdir(relative_path, function (err, files) {
    
            if (err) {
                throw err;
            }
    
            var schemaPath = files.indexOf("schema.sql")
    
            if (schemaPath > -1) {
                files.splice(schemaPath, 1)
            }
    
            cb(files)
    
        })
    }

}

const coreFunctions = {

    'add_migration': function (argv, cb) {
    
        fileFunctions.validate_file_name(argv[4])
    
        fileFunctions.readFolder(function (files) {
    
            var file_name = Date.now() + "_" + argv[4]
            var file_path = root_path+migrations_path + '/' + file_name + '.js'
    
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
    
                console.info( colors.green("Added file migration: " + file_name ))
    
                cb()
    
            })
    
        })
    
    },
    
    'up_migrations': function (conn, max_count, cb) {
    
        queryFunctions.run_query(conn, "SELECT timestamp FROM " + table + " ORDER BY timestamp DESC LIMIT 1", function (results) {
    
            var file_paths = []
            var max_timestamp = 0
    
            if (results.length) {
                max_timestamp = results[0].timestamp
            }
    
            fileFunctions.readFolder(function (files) {
    
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
    
                queryFunctions.execute_query(conn, final_file_paths, 'up', cb)
    
            })
    
        })
    },
    
    'up_migrations_all': function(conn, max_count, cb) {
    
        queryFunctions.run_query(conn, "SELECT timestamp FROM " + table, function (results) {
    
            var file_paths = []
            var timestamps = results.map(r => parseInt(r.timestamp))
    
            fileFunctions.readFolder(function (files) {
    
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
                queryFunctions.execute_query(conn, final_file_paths, 'up', cb)
            })
    
        })
    },
    
    'down_migrations':function (conn, max_count, cb) {
    
        queryFunctions.run_query(conn, "SELECT timestamp FROM " + table + " ORDER BY timestamp DESC LIMIT " + max_count, function (results) {
    
            var file_paths = []
    
            if (results.length) {
    
                var temp_timestamps = results.map(function (ele) {
                    return ele.timestamp
                })
    
                fileFunctions.readFolder( function (files) {
    
                    files.forEach(function (file) {
    
                        var timestamp = file.split("_", 1)[0]
    
                        if (temp_timestamps.indexOf(timestamp) > -1) {
                            file_paths.push({ 'timestamp' : timestamp, file_path : file})
                        }
    
                    })
    
                    var final_file_paths = file_paths.sort(function(a, b) { return (b.timestamp - a.timestamp)}).slice(0, max_count)
                    queryFunctions.execute_query(conn, final_file_paths, 'down', cb)
    
                })
            }
    
        })
    },
    
    'run_migration_directly':async function(file, type, conn, cb) {
    
        var current_file_path = migrations_path + "/" + file
        
        const file_data = await import(current_file_path)
    
        const query = file_data.default
        
        if (typeof (query[type]) == 'string') {
    
            console.info(`Direct: ${type.toUpperCase()} Query: "${query[type].toString()}"`)
            queryFunctions.run_query(conn, query[type], cb)
            console.info( colors.blue('Direct: Query String!') )
    
        } else if (typeof (query[type]) == 'function') {
    
            console.info(`Direct: ${type.toUpperCase()} Function: "${query[type]}"`)
            query[type](conn, cb)
            console.info( colors.blue('Direct: Query Function!') )
    
        }
    
    
    },
    
    'update_schema':function(conn, cb) {
    
        var conn_config = conn.config.connectionConfig
        var filePath = migrations_path + '/' + 'schema.sql'
    
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
          cmd = cmd + " --password=" + conn_config.password;
        }
    
        cmd = cmd + " " + conn_config.database
    
        exec(cmd, function (error, stdout, stderr) {
    
            fs.writeFile(filePath, stdout, function (err) {
    
                if (err) {
                    console.log(colors.red("Could not save schema file"))
                }
    
                cb()
    
            })
        })
    
      })
    },
    
    'createFromSchema':function(conn, cb) {
    
        var conn_config = conn.config.connectionConfig
      
        var filePath = migrations_path + '/' + 'schema.sql'
      
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
            
                    fileFunctions.readFolder(function (files) {
              
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
              
                        queryFunctions.execute_query(conn, path, final_file_paths, 'up', cb, false)
    
                    })
    
                }
    
            })
    
        } else {
            console.log(colors.red("Schema Missing: " + filePath))
            cb()
        }
    
    }
    
}

function migration(conn, cb, options) {
  
    if(cb == null) cb = () => {}

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

    queryFunctions.run_query(conn, "CREATE TABLE IF NOT EXISTS `" + table + "` (`timestamp` varchar(254) NOT NULL UNIQUE)", function (res) {
        handle(argv, conn, cb)
    })

}

function handle(argv, conn, cb) {

    if (argv.length > 2 && argv.length <= 6) {

        if (argv[2] == 'add' && (argv[3] == 'migration' || argv[3] == 'seed')) {

            coreFunctions.add_migration(argv, function () {
                conn.end()
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
                coreFunctions.up_migrations_all(conn, count, function () {
                    updateSchemaAndEnd(conn)
                    cb()
                })

            } else {

                coreFunctions.up_migrations(conn, count, function () {
                    updateSchemaAndEnd(conn)
                    cb()
                })
            }

        } else if (argv[2] == 'down') {

            var count = null

            if (argv.length > 3) {
                count = parseInt(argv[3])
            } else count = 1

                coreFunctions.down_migrations(conn, count, function () {
                    updateSchemaAndEnd(conn)
                    cb()
                })

        } else if (argv[2] == 'refresh') {

            coreFunctions.down_migrations(conn, 999999, function () {

                coreFunctions.up_migrations(conn, 999999, function () {
                    updateSchemaAndEnd(conn)
                    cb()
                })

            })

        } else if (argv[2] == 'run' && migrations_types.indexOf(argv[4]) > -1) {

            coreFunctions.run_migration_directly(argv[3], argv[4], conn, function () {
                updateSchemaAndEnd(conn);
                cb()
            })

        } else if (argv[2] == 'load-from-schema') {

            coreFunctions.createFromSchema(conn, function () {
               conn.end()
               cb()
            })

        } else{
            throw new Error('command not found : ' + argv.join(" "))
        }

    }
}

function updateSchemaAndEnd(conn) {

    if (updateSchema) {

        coreFunctions.update_schema(conn, function () {
            conn.end()
        })

    } else {
        conn.end()
    }
}

export default {
    'start': migration
}
