let mysql = require('mysql');
let express =  require('express');
let app = express();
let bodyParser = require('body-parser');
let logger = require('morgan');
let methodOverride = require('method-override')
let cors = require('cors');
let http = require('http').Server(app);
var moment = require('moment');
var qr = require('qr-image');  

const synctime = 10000;
const nodemailer = require('nodemailer');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(cors());

let con = mysql.createConnection({
    host: "venda-online.cacasorqzf2r.sa-east-1.rds.amazonaws.com",
    user: "bilheteria",
    password: "c4d3Oc0ntr4t0",
    database: "vendas_online"
 });

 /*let conLocal = mysql.createConnection({
    host: "10.0.2.180",
    user: "3access",
    password: "3access",
    database: "zoosp"
 });*/

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
    
	 setInterval(function(){ 
		syncDatabases()
	 }, synctime);
});

conLocal.connect(function(err) {
    if (err) throw err;
	log_("Database local conectado!")		    
    log_("Aguardando conexões ...")	
});

function log_(str){
    let now = moment().format("DD/MM/YYYY hh:mm:ss")
    let msg = "[" + now + "] " + str
    console.log(msg)
}

var transporte = nodemailer.createTransport({
    service: 'Gmail', 
    auth: {
      user: 'myrestaurantwebapp', 
      pass: ''
    } 
});

function sendEmail(files){
    
    let array = []        

    files.forEach(file => {
        let filename_ = file + '.png'
        let path_ = './qrcodes/' + filename_
        array.push({filename: filename_, path: path_})
    });

    console.log(array)
 
    var email = {
        from: 'myrestaurantwebapp@gmail.com', 
        to: 'shaamangra@gmail.com', 
        subject: 'Qr Code ingresso', 
        html: 'Olá! Obrigado por adquirir o ingresso. Segue em anexo o qrcode. <strong>https://www.megaticket.com.br</strong>' ,
        attachments: array
    };

    transporte.sendMail(email, function(err, info){
        if(err)
            throw err;
    
        console.log('Email enviado! Leia as informações adicionais: ', info);
    });
}

function coord2offset(x, y, size) {
    return (size + 1) * y + x + 1;
}

function customize(bitmap) {
    const size = bitmap.size;
    const data = bitmap.data;

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < x; y++) {
            const offset = coord2offset(x, y, size);
            if (data[offset]) {
                data[offset] = 255 - Math.abs(x - y);
            }
        }
    }
}

function generateQrCode(ticket){

    let file = './qrcodes/' + ticket + '.png'
    
    return qr.image(ticket, {
        type: 'png',
        customize
    }).pipe(
        require('fs').createWriteStream(file)
    );
}


function syncDatabases(){
	log_("Verificando novas vendas")
	
    let sql = "select \
        p.ID as order_id,\
        p.post_date,\
        max( CASE WHEN pm.meta_key = '_billing_email' and p.ID = pm.post_id THEN pm.meta_value END ) as billing_email,\
        max( CASE WHEN pm.meta_key = '_billing_first_name' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_first_name,\
        max( CASE WHEN pm.meta_key = '_billing_last_name' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_last_name,\
        max( CASE WHEN pm.meta_key = '_billing_cpf' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_cpf,\
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
		sync = 0 and \
        post_status = 'wc-completed' \
    group by \
        p.ID"
        
    //log_(sql)

    con.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        
        if(result.length > 0)
            syncDatabaseContinue(result)
    });
}

function syncDatabaseContinue(data){   
    log_("Preparando base local para sincronização")

    let sql = "SELECT id_estoque_utilizavel FROM 3a_estoque_utilizavel ORDER BY id_estoque_utilizavel DESC LIMIT 1";
    //log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;   

        createTicket(result, data)
    });    
}

function createTicket(tickets, data){
    
    let order_id = 0;
    let qrcodesTickets = []

    for (var j = 0; j < tickets.length; j++) {        

        let id_estoque_utilizavel = tickets[j].id_estoque_utilizavel
        let id_ticket_criado = ++id_estoque_utilizavel

        for (var i = 0; i < data.length; i++) {

            order_id = data[i].order_id
            updateTicketsSyncIds(order_id)

            let order_items = data[i].order_items
            var arr = order_items.toString().split("|");            
            let post_date = data[i].post_date
            let billing_email = data[i].billing_email
            let _billing_first_name = data[i]._billing_first_name
            let _billing_last_name = data[i]._billing_last_name
            let _billing_address_1 = data[i]._billing_address_1
            let _billing_address_2 = data[i]._billing_address_2
            let _billing_city = data[i]._billing_city
            let _billing_cpf = data[i]._billing_cpf
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
            
            for (var k = 0; k < arr.length; k++) {

                let produto = arr[k]                
                let ticketId = id_ticket_criado++        
                
                let msg = "Criando ingresso: " +  ticketId + " - Produto: " + produto + " - Ordem de venda: " + order_id
                log_(msg)

                let sql = "INSERT INTO 3a_estoque_utilizavel (id_estoque_utilizavel,fk_id_produto,fk_id_tipo_estoque,fk_id_usuarios_inclusao,data_inclusao_utilizavel, impresso) \
                    VALUES(" + ticketId + ",\
                        (SELECT id_produto FROM 3a_produto WHERE nome_produto = '" + produto + "' ORDER BY id_produto DESC LIMIT 1 ),\
                        1,1,NOW(), 1);"                                          
                        
                let sqlOnline = "INSERT INTO 3a_vendas_online (order_id, post_date, billing_email, _billing_first_name, _billing_last_name, _billing_address_1,\
                    _billing_address_2, _billing_city, _billing_state, _billing_postcode, _shipping_first_name, _shipping_last_name, _shipping_address_1, _shipping_address_2, _shipping_city, _shipping_state,\
                    _shipping_postcode, order_total, order_tax, paid_date, order_items, id_estoque_utilizavel, _billing_cpf) VALUES \
                        (" + order_id + ", '" + post_date + "', '" + billing_email + "', '" + _billing_first_name + "', '" + _billing_last_name + "', '" + _billing_address_1 + "', '" + _billing_address_2 + "', '" + _billing_city + "', '" +
                        _billing_state + "', '" + _billing_postcode + "', '" + _shipping_first_name + "', '" + _shipping_last_name + "', '" + _shipping_address_1 + "', '" + _shipping_address_2 + "', '" +
                        _shipping_city + "', '" + _shipping_state + "', '" + _shipping_postcode + "', " + order_total + ", " + order_tax + ", '" + paid_date + "', '"  + produto + "', " + ticketId + ", '" + _billing_cpf + "');";

                //log_(sql)
                //log_(sqlOnline)

                conLocal.query(sql, function (err1, result) {  
                    if (err1) throw err1;                                                               

                    soldTicket(ticketId, produto, order_total)   

                    generateQrCode(ticketId)

                    qrcodesTickets.push(ticketId)
                    
                    conLocal.query(sqlOnline, function (err2, result2) {  
                        if (err2) throw err2;                          
                    });
                });                
            }                  
        }
    }
    
    setTimeout(function(){ 
        sendEmail(qrcodesTickets)
    }, 3000);
}

function soldTicket(ticketId, produto, valor){
    let msg = "Vendendo ingresso: " + ticketId + " - Produto: " + produto
    log_(msg)

    let user = 1
    let idCaixa = 1
    let obs = "Pagamento Online"
    let ip = "localhost"
    let tipoPagamento = 1
    let validade = 1

    let sql = "INSERT INTO 3a_log_vendas (\
        fk_id_estoque_utilizavel,\
        fk_id_usuarios,\
        fk_id_produto,\
        fk_id_subtipo_produto,\
        fk_id_caixa_registrado,\
        valor_log_venda,\
        data_log_venda,\
        obs_log_venda,\
        ip_maquina_venda,\
        nome_maquina_venda,\
        fk_id_tipo_pagamento,\
        fk_id_validade) \
    VALUES("
     + ticketId + "," 
     + user + ", \
     (SELECT id_produto FROM 3a_produto WHERE nome_produto = '" + produto + "' ORDER BY id_produto DESC LIMIT 1 ),\
     (SELECT fk_id_subtipo_produto FROM 3a_produto WHERE nome_produto = '" + produto + "' ORDER BY id_produto DESC LIMIT 1 ),"
     + idCaixa + "," +
     + valor + "," +
     "NOW(), '" 
     + obs + "', '" 
     + ip + "'," 
     + "'none',"
     + tipoPagamento + ","
     + validade + ");"

    //log_(sql)

    conLocal.query(sql, function (err2, result2) {  
        if (err2) throw err2;                                             
    });
}

function updateTicketsSyncIds(id_order){    

    let sql = "UPDATE wp_posts SET sync = 1 WHERE ID = " + id_order + ";"; 
    //log_(sql)

    con.query(sql, function (err1, result) {  
        if (err1) throw err1;                    
    });    
}

app.post('/getAllOrders', function(req, res) {    

    let start = req.body.start
    let end = req.body.end

    let sql = "SELECT * FROM 3a_vendas_online WHERE datetime BETWEEN '" + start + "' AND '" + end + "';"
    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
});

app.post('/getAllOrdersByName', function(req, res) {

    let name = req.body.name
    let start = req.body.start
    let end = req.body.end

    let sql = "SELECT * \
        FROM 3a_vendas_online \
        WHERE _billing_first_name LIKE '%" + name + "%' \
        OR _billing_cpf = '" + name + "' \
        AND datetime BETWEEN '" + start + "' AND '" + end + "';"

    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
});

http.listen(8085);