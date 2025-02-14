
import colors from "colors"
import __query from "./helper.js"
import os from "os"

export default class Migration {
    
    constructor(){
        this.host= 'localhost',
        this.port = 3306
        this.user= 'root',
        this.database= 'test',
        this.password = 'paswword',
        this.name_app = os.hostname() || os.userInfo().username || "Sabueso",
        this.name_table_migrations = "table_migrations_app",
        this.show_query=false,
        this.show_depuration=false
    }

    start= async()=>{
        const result = await __query({
            "host": this.host,
            "port": this.port,
            "user": this.user,
            "database": this.database,
            "password" : this.password,
            "name_app": this.name_app,
            "table": (typeof this.name_table_migrations === "string" && this.name_table_migrations.length <= 60) ? this.name_table_migrations : "table_migrations_app",
            "migrations_types": ["up","down"],
            "show_query": typeof this.show_query === "boolean" ? this.show_query : false,
            "cb":(messageEvent="")=>{
                console.info(colors.bgCyan(colors.bgMagenta(this.name_app)+" Command "+colors.bgMagenta(messageEvent)+" Finished! "))
            }
        })
        if( typeof this.show_depuration === "boolean" && this.show_depuration){
            console.info("mysql2-migrations log:",result)
        }
        process.exit(0)
    }

}