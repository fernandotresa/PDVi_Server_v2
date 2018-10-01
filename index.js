let mysql = require('mysql');
let express =  require('express');
let app = express();
let bodyParser = require('body-parser');
let logger = require('morgan');
let methodOverride = require('method-override')
let cors = require('cors');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(cors());

let con = mysql.createConnection({
    host: "dev.cxr1ymefkdso.us-east-1.rds.amazonaws.com",
    user: "bilheteria",
    password: "c4d3Oc0ntr4t0",
    database: "bilheteria"
 });

 let conLocal = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "senhaRoot",
    database: "3a_access"
 });

 con.connect(function(err) {
    if (err) throw err;
	log_("Database woocommerce conectado!")		    
    log_("Aguardando conexões ...")	

    syncDatabases()
});

conLocal.connect(function(err) {
    if (err) throw err;
	log_("Database local conectado!")		    
    log_("Aguardando conexões ...")	
});

function log_(str){
    console.log(str)
}

function syncDatabases(){
    let sql = "select \
        p.ID as order_id,\
        p.post_date,\
        max( CASE WHEN pm.meta_key = '_billing_email' and p.ID = pm.post_id THEN pm.meta_value END ) as billing_email,\
        max( CASE WHEN pm.meta_key = '_billing_first_name' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_first_name,\
        max( CASE WHEN pm.meta_key = '_billing_last_name' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_last_name,\
        max( CASE WHEN pm.meta_key = '_billing_address_1' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_address_1,\
        max( CASE WHEN pm.meta_key = '_billing_address_2' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_address_2,\
        max( CASE WHEN pm.meta_key = '_billing_city' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_city,\
        max( CASE WHEN pm.meta_key = '_billing_state' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_state,\
        max( CASE WHEN pm.meta_key = '_billing_postcode' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_postcode,\
        max( CASE WHEN pm.meta_key = '_shipping_first_name' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_first_name,\
        max( CASE WHEN pm.meta_key = '_shipping_last_name' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_last_name,\
        max( CASE WHEN pm.meta_key = '_shipping_address_1' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_address_1,\
        max( CASE WHEN pm.meta_key = '_shipping_address_2' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_address_2,\
        max( CASE WHEN pm.meta_key = '_shipping_city' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_city,\
        max( CASE WHEN pm.meta_key = '_shipping_state' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_state,\
        max( CASE WHEN pm.meta_key = '_shipping_postcode' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_postcode,\
        max( CASE WHEN pm.meta_key = '_order_total' and p.ID = pm.post_id THEN pm.meta_value END ) as order_total,\
        max( CASE WHEN pm.meta_key = '_order_tax' and p.ID = pm.post_id THEN pm.meta_value END ) as order_tax,\
        max( CASE WHEN pm.meta_key = '_paid_date' and p.ID = pm.post_id THEN pm.meta_value END ) as paid_date,\
        ( select group_concat( order_item_name separator '|' ) from wp_woocommerce_order_items where order_id = p.ID ) as order_items \
    from \
        wp_posts p \
        join wp_postmeta pm on p.ID = pm.post_id \
        join wp_woocommerce_order_items oi on p.ID = oi.order_id \
    where \
        post_type = 'shop_order' and \
        post_status = 'wc-completed' \
    group by \
        p.ID"
        
    //console.log(sql)

    con.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        
        syncDatabaseContinue(result)
    });
}

function syncDatabaseContinue(data){

    var length = Object.keys(data).length;
    console.log("Sincronizando vendas com banco local. Tamanho: ", length)

    for (var i = 0; i < length; i++) 
    {
        let order_id = data[i].order_id
        let post_date = data[i].post_date
        let billing_email = data[i].billing_email
        let _billing_first_name = data[i]._billing_first_name
        let _billing_last_name = data[i]._billing_last_name
        let _billing_address_1 = data[i]._billing_address_1
        let _billing_address_2 = data[i]._billing_address_2
        let _billing_city = data[i]._billing_city
        let _billing_state = data[i]._billing_state
        let _billing_postcode = data[i]._billing_postcode
        let _shipping_first_name = data[i]._shipping_first_name
        let _shipping_last_name = data[i]._shipping_last_name
        let _shipping_address_1 = data[i]._shipping_address_1
        let _shipping_address_2 = data[i]._shipping_address_2
        let _shipping_city = data[i]._shipping_city
        let _shipping_state = data[i]._shipping_state
        let _shipping_postcode = data[i]._shipping_postcode
        let order_total = data[i].order_total
        let order_tax = data[i].order_tax
        let paid_date = data[i].paid_date
        let order_items = data[i].order_items

        let sql = "INSERT INTO 3a_vendas_online (order_id, post_date, billing_email, _billing_first_name, _billing_last_name, _billing_address_1,\
                    _billing_address_2, _billing_city, _billing_state, _billing_postcode, _shipping_first_name, _shipping_last_name, _shipping_address_1, _shipping_address_2, _shipping_city, _shipping_state,\
                    _shipping_postcode, order_total, order_tax, paid_date, order_items) VALUES \
            (" + order_id + ", '" + post_date + "', '" + billing_email + "', '" + _billing_first_name + "', '" + _billing_last_name + "', '" + _billing_address_1 + "', '" + _billing_address_2 + "', '" + _billing_city + "', '" +
            _billing_state + "', '" + _billing_postcode + "', '" + _shipping_first_name + "', '" + _shipping_last_name + "', '" + _shipping_address_1 + "', '" + _shipping_address_2 + "', '" +
            _shipping_city + "', '" + _shipping_state + "', '" + _shipping_postcode + "', " + order_total + ", " + order_tax + ", '" + paid_date + "', '"  + order_items + "' );"
    
        //console.log(sql)

        conLocal.query(sql, function (err1, result) {  
            if (err1) throw err1;            
        });        
    };

    getLastTicket(data)    
}

function getLastTicket(data){

    for (var i = 0; i < data.length; i++){
        let sql = "SELECT id_estoque_utilizavel FROM 3a_estoque_utilizavel ORDER BY id_estoque_utilizavel DESC LIMIT 1";

        conLocal.query(sql, function (err1, result) {  
            if (err1) throw err1;            
            createTicket(result, data)
        });
    }
    
}


function createTicket(tickets, data){

    for (var j = 0; j < tickets.length; j++) {        

        let id_estoque_utilizavel = tickets[j].id_estoque_utilizavel
        let id_ticket_criado = id_estoque_utilizavel++

        console.log("Criando ingresso", id_ticket_criado, id_estoque_utilizavel)

        for (var i = 0; i < data.length; i++) {

            //console.log(data[i])
            let order_items = data[i].order_items

            var arr = order_items.toString().split("|");
            console.log(arr);

            let sql = "INSERT INTO 3a_estoque_utilizavel (id_estoque_utilizavel,fk_id_produto,fk_id_tipo_estoque,fk_id_usuarios_inclusao,data_inclusao_utilizavel) \
                    VALUES(" + id_ticket_criado + ",\
                        (SELECT id_produto FROM 3a_produto WHERE nome_produto = '" + order_items + "' ORDER BY id_produto DESC LIMIT 1 ),\
                        1,1,NOW());"

           // console.log(sql)    
            
           /* conLocal.query(sql, function (err1, result) {  
                if (err1) throw err1;            
            });   */     
      }

    }        
}


