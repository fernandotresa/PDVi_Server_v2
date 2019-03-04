let mysql = require('mysql');
let express =  require('express');
let app = express();
let bodyParser = require('body-parser');
let logger = require('morgan');
let methodOverride = require('method-override')
let cors = require('cors');
let http = require('http').Server(app);
var moment = require('moment');
var momenttz = require('moment-timezone');
var qr = require('qr-image');  
let shell = require('shelljs');

var os = require('os');
var ifaces = os.networkInterfaces();
var ipAddressLocal = "localhost"

const synctime = 10000;
let clientName = 'Museu de Arte Sacra'

let clientItensOnline = []

const nodemailer = require('nodemailer');
var msgEmail = 'Olá! Obrigado por adquirir o ingresso. Segue em anexo o qrcode. <strong>https://www.megaticket.com.br</strong>'
var emailFrom = 'myrestaurantwebapp@gmail.com'
var emailSubject = 'Qr Code ingresso'
var pathQRCode = './qrcodes/'

var worksOnline = 0
var idUserOnline = 1

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(cors());

var db_config_remote = {
    host: "venda-online.cacasorqzf2r.sa-east-1.rds.amazonaws.com",
    user: "bilheteria",
    password: "c4d3Oc0ntr4t0",
    database: "vendas_online"
};

var db_config_local = {
    //host: "10.8.0.46",
    //host: "10.8.0.50",
    host: "10.19.31.247",
    //host: "10.0.2.180",
    user: "root",
    password: "Mudaragora00",
    //database: "zoosp"
    database: "3access"
};

let con;
let conLocal;

function handleDisconnectRemote() {

    con = mysql.createConnection(db_config_remote);
   
    con.connect(function(err) {
       if (err){
        setTimeout(handleDisconnectRemote, 2000);
       }

       con.on('error', function(err) {

        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnectRemote();  

        } else 
            throw err;  
        
    });

    log_("Database conectado!")		    
    log_("Aguardando conexões ...")	
   });
}

function handleDisconnectRemote() {

    con = mysql.createConnection(db_config_remote);
   
    con.connect(function(err) {
       if (err){
        setTimeout(handleDisconnectRemote, 2000);
       }

       con.on('error', function(err) {

        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnectRemote();  

        } else 
            throw err;  
        
    });

    log_("Database remoto conectado!")		    
    log_("Aguardando conexões ...")	
   });
}

function handleDisconnectLocal() {

    conLocal = mysql.createConnection(db_config_local);
   
    conLocal.connect(function(err) {
       if (err){
        setTimeout(handleDisconnectLocal, 2000);
       }

       conLocal.on('error', function(err) {

        if(err.code === 'PROTOCOL_CONNECTION_LOST')
            handleDisconnectLocal();  
        else 
            throw err;  
        
    });

    log_("Database local conectado!")		    
    log_("Aguardando conexões ...")	
   });
}

function startInterface(){

    if(worksOnline === 1){
        
        handleDisconnectRemote();    
        getProductsClient()

        setInterval(function(){ 
        syncDatabases()
     }, synctime);
    }    

    handleDisconnectLocal();        
    startIpAddress()    
}

function startIpAddress(){
    Object.keys(ifaces).forEach(function (ifname) {
      
        ifaces[ifname].forEach(function (iface) {
          
          if ('IPv4' !== iface.family || iface.internal !== false)
            return;          

          ipAddressLocal = iface.address

          if(ipAddressLocal.indexOf("10.8.0.") > -1)
              return;        
        })
    })
}

startInterface();

function log_(str){
    let now = moment().format("DD/MM/YYYY hh:mm:ss")
    let msg = "[" + now + "] " + str
    console.log(msg)
}

var transporte = nodemailer.createTransport({
    service: 'Gmail', 
    auth: {
      user: 'myrestaurantwebapp', 
      pass: '123edcdiego'
    } 
});


function printFile(tipoIngresso, valorIngresso, operador, dataHora, idTicket, totalVenda, reprint){
    
    console.log("Realizando impressão do ingresso ", idTicket)

    let cmd = 'sh impressao.sh "' + tipoIngresso + '" ' + valorIngresso + ' ' + operador + ' "' 
                + dataHora + '" ' + idTicket + ' ' + totalVenda
    
    if(reprint === 1){
        cmd = 'sh reimpressao.sh "' + tipoIngresso + '" ' + valorIngresso + ' ' + operador + ' "' 
        + dataHora + '" ' + idTicket + ' ' + totalVenda
    }
    
    console.log(cmd)

    shell.exec(cmd, {async: false}, function(code, stdout, stderr) {
        console.log('Exit code:', code);
        console.log('Program output:', stdout);
        console.log('Program stderr:', stderr);        
    });
}

function sendEmail(files, emailAddr){
    
    let array = []        

    files.forEach(file => {
        let filename_ = file + '.png'
        let path_ = './qrcodes/' + filename_
        array.push({filename: filename_, path: path_})
    });
 
    let emailRecipe = {
        from: emailFrom, 
        to: emailAddr, 
        subject: emailSubject, 
        html:  msgEmail,
        attachments: array
    };

    transporte.sendMail(emailRecipe, function(err, info){
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

    let file = pathQRCode + ticket + '.png'
    
    return qr.image(ticket, {
        type: 'png',
        customize
    }).pipe(
        require('fs').createWriteStream(file)
    );
}

/**
 * Get all itens avaiable for the client on store
 */
function getProductsClient(){

    let sql = "SELECT wp_term_relationships.object_id \
            FROM wp_term_relationships \
            LEFT JOIN wp_posts  ON wp_term_relationships.object_id = wp_posts.ID \
            LEFT JOIN wp_term_taxonomy ON wp_term_taxonomy.term_taxonomy_id = wp_term_relationships.term_taxonomy_id \
            LEFT JOIN wp_terms ON wp_terms.term_id = wp_term_relationships.term_taxonomy_id \
                WHERE post_type = 'product' \
                AND taxonomy = 'product_cat' \
                AND name = '" + clientName + "'"; 

    log_(sql)

    con.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
                
        populateProductClientArray(result)
    });   
}

/**
 * Keep the results on clientItensOnline
 */
function populateProductClientArray(data){

    for (var i = 0; i < data.length; i++) {
        object_id = data[i].object_id
        clientItensOnline.push(object_id)        
    }

    console.log("Ids dos produtos do cliente: ", clientName, clientItensOnline)
}

/**
 * Search for new products to synchonize. 
 * Use the specific WHERE In combination with the clientItensOline array
 */
function syncDatabases(){
	
    let sql = "SELECT \
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
    FROM \
        wp_posts p \
        JOIN wp_postmeta pm on p.ID = pm.post_id \
        JOIN wp_woocommerce_order_items oi on p.ID = oi.order_id \
        INNER JOIN wp_woocommerce_order_items as woi on ( woi.order_id = p.ID ) \
        INNER JOIN wp_woocommerce_order_itemmeta as woim on ( woim.order_item_id = woi.order_item_id ) \
        INNER JOIN wp_term_relationships as wtr on ( wtr.object_id = woim.meta_value ) \
    WHERE \
        post_type = 'shop_order' \
		AND sync = 0 \
        AND post_status = 'wc-completed' \
        AND wtr.object_id IN (" + clientItensOnline + ") \
    GROUP BY \
        p.ID"
        
    //log_(sql)

    con.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        
        if(result.length > 0)
            syncDatabaseContinue(result)
    });
}

/**
 * Separate the order products and create on the local base the specifics itens  
 */
function syncDatabaseContinue(data){
    
    log_("Sincronizando novas compras")

    let sqlCashier = "INSERT INTO 3a_caixa_registrado (fk_id_usuario, data_caixa_registrado, obs_log_venda) \
        VALUES (" + idUserOnline + ", NOW(), 'Gerado pelo sistema PDVi Web');"

    log_(sqlCashier)        

    conLocal.query(sqlCashier, function (err1, result) {        
        if (err1) throw err1;

        let sql = "SELECT 3a_caixa_registrado.id_caixa_registrado \
            FROM 3a_caixa_registrado \
            WHERE 3a_caixa_registrado.fk_id_usuario = " + idUserOnline + " \
            ORDER BY data_caixa_registrado DESC LIMIT 1"
    
        log_(sql)

        conLocal.query(sql, function (err, result) {        
            if (err) throw err;           

            syncDatabaseFinish(data, result)
        });
    });                   
}

function syncDatabaseFinish(data, caixa){

    let id_caixa_registrado = caixa[0].id_caixa_registrado
    log_("Último caixa registrado: " + id_caixa_registrado)

    for (var i = 0; i < data.length; i++) {                

        let itens = data[i]
        let order_items = itens.order_items
        let arr = order_items.toString().split("|");                                        

        for (var k = 0; k < arr.length; k++) {

            let produto = arr[k]                                                                              
            createTicketBaseLocal(produto, itens, i, id_caixa_registrado)
        }                  
    }    
}

/**
 * Search information about the product on local base
 */
function createTicketBaseLocal(productName, itens, k, id_caixa_registrado){

    let sql = "SELECT * FROM 3a_produto WHERE nome_produto = '" + productName + "';";
    
    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                                                
    
        let product = result[0]

        if(product){

            let prefixo = product.prefixo_produto
            let prefixo_ini=prefixo*1000000;
            let prefixo_fim=prefixo_ini+999999;

            product.fk_id_caixa_venda = id_caixa_registrado
        
            let sqlPrefix = "SELECT IFNULL(MAX(id_estoque_utilizavel) + 1, " + prefixo_ini + ") AS id_estoque_utilizavel \
                FROM 3a_estoque_utilizavel \
                WHERE id_estoque_utilizavel \
                BETWEEN " + prefixo_ini + " \
                AND " + prefixo_fim + ";"        

            conLocal.query(sqlPrefix, function (err1, result1) {  
                if (err1) throw err1;                    

                let id_estoque_utilizavel = result1[0].id_estoque_utilizavel    
                let id_estoque =  id_estoque_utilizavel + k    
                
                createTicketDatabaseLocal(product, id_estoque)                
                createTicketBaseLocalContinue(result1, itens, product)                
            });        
        }                
    }); 
}

function createTicketBaseLocalContinue(data, itens, product){    
    
    let order_id = itens.order_id
    updateTicketsSyncIds(order_id)

    let order_items = itens.order_items
    let post_date = itens.post_date
    let billing_email = itens.billing_email
    let _billing_first_name = itens._billing_first_name
    let _billing_last_name = itens._billing_last_name
    let _billing_address_1 = itens._billing_address_1
    let _billing_address_2 = itens._billing_address_2
    let _billing_city = itens._billing_city
    let _billing_cpf = itens._billing_cpf
    let _billing_state = itens._billing_state
    let _billing_postcode = itens._billing_postcode
    let _shipping_first_name = itens._shipping_first_name
    let _shipping_last_name = itens._shipping_last_name
    let _shipping_address_1 = itens._shipping_address_1
    let _shipping_address_2 = itens._shipping_address_2
    let _shipping_city = itens._shipping_city
    let _shipping_state = itens._shipping_state
    let _shipping_postcode = itens._shipping_postcode
    let order_total = itens.order_total
    let order_tax = itens.order_tax
    let paid_date = itens.paid_date 

    let id_estoque_utilizavel = data[0].id_estoque_utilizavel
                       
    let sql = "INSERT INTO 3a_vendas_online (order_id, post_date, billing_email, _billing_first_name, _billing_last_name, _billing_address_1,\
        _billing_address_2, _billing_city, _billing_state, _billing_postcode, _shipping_first_name, _shipping_last_name, _shipping_address_1, _shipping_address_2, _shipping_city, _shipping_state,\
        _shipping_postcode, order_total, order_tax, paid_date, order_items, id_estoque_utilizavel, _billing_cpf) VALUES \
            (" + order_id + ", '" + post_date + "', '" + billing_email + "', '" + _billing_first_name + "', '" + _billing_last_name + "', '" + _billing_address_1 + "', '" + _billing_address_2 + "', '" + _billing_city + "', '" +
            _billing_state + "', '" + _billing_postcode + "', '" + _shipping_first_name + "', '" + _shipping_last_name + "', '" + _shipping_address_1 + "', '" + _shipping_address_2 + "', '" +
            _shipping_city + "', '" + _shipping_state + "', '" + _shipping_postcode + "', " + order_total + ", " + order_tax + ", '" + paid_date + "', '"  + order_items + "', " + 
            id_estoque_utilizavel + ", '" + _billing_cpf + "');";

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                              
    });
}

function createTicketDatabaseLocal(product, id_estoque_utilizavel){

    let id_produto = product.id_produto
    let userId = 1

    let sql = "INSERT INTO 3a_estoque_utilizavel (id_estoque_utilizavel,fk_id_produto,fk_id_tipo_estoque,fk_id_usuarios_inclusao,data_inclusao_utilizavel, impresso) \
        VALUES(" + id_estoque_utilizavel + ", " + id_produto + ", 1," + userId + ", NOW(), 1);"                       

    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;  

        soldTicket(product, "ONLINE", id_estoque_utilizavel, userId)                            
    });    
}

function soldTicket(produto, tipoPagamento, last, userId){
    
    let user = userId
    let obs = "Vendido pelo sistema online"
    let ip = "localhost"
    let validade = 1
    let id_estoque_utilizavel = last
    let fk_id_subtipo_produto = produto.fk_id_subtipo_produto
    let valor = produto.valor_produto
    let id_produto = produto.id_produto
    let fk_id_caixa_venda = produto.fk_id_caixa_venda

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
     + id_estoque_utilizavel + ", " 
     + user + ", "
     + id_produto + ", "
     + fk_id_subtipo_produto + ", "
     + fk_id_caixa_venda + ", " +
     + valor + ", " +
     "NOW(), '" 
     + obs + "', '" 
     + ip + "'," 
     + "'PDVi',"
     + "(SELECT 3a_tipo_pagamento.id_tipo_pagamento FROM 3a_tipo_pagamento WHERE 3a_tipo_pagamento.nome_tipo_pagamento = '" + tipoPagamento + "'),"
     + validade + ");"    

    conLocal.query(sql, function (err2, result2) {          
        if (err2) throw err2;                       

        log_(sql)
    });
}

function updateTicketsSyncIds(id_order){    

    let sql = "UPDATE wp_posts SET sync = 1 WHERE ID = " + id_order + ";"; 
    //log_(sql)

    con.query(sql, function (err1, result) {  
        if (err1) throw err1;                    
    });    
}

function payProduct(req, res){

    let products = req.body.products    
    var productsCount = 0;

    for (var i = 0, len = products.length; i < len; i++) {
        
        let product = products[i]
        let isParking = product.parking
        productsCount++

        if(isParking)
            payParking(req, product)
        else
            payProductNormal(req, product)    
            
        if(productsCount == products.length){
            res.json({"success": 1});  
        }
    }              
}

function payProductNormal(req, product){

    let prefixo = product.prefixo_produto
    let prefixo_ini=prefixo*1000000;
    let prefixo_fim=prefixo_ini+999999;
    
    let sql = "SELECT IFNULL(MAX(id_estoque_utilizavel), " + prefixo_ini + ") AS TOTAL \
        FROM 3a_estoque_utilizavel \
        WHERE id_estoque_utilizavel \
        BETWEEN " + prefixo_ini + " \
        AND " + prefixo_fim + ";"               

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;            

        log_(sql) 
        payProductContinue(req, product, result)
    });
}

function payParking(req, product){
    
    let userId = req.body.userId    
    let idPayment = req.body.idPayment    
    let quantity = product.quantity
    let last = product.id_estoque_utilizavel

    for(var j = 0; j < quantity; j++){               
        soldTicket(product, idPayment, last, userId)         
    }    
}

function payProductContinue(req, product, data){            

    let id_estoque_utilizavel = data[0].TOTAL           
    let userId = req.body.userId    
    let id_produto = product.id_produto            
    let quantity = product.quantity
    let selectedsIds = product.selectedsIds        

    for(var j = 0; j < quantity; j++){
                
        let last = ++id_estoque_utilizavel
        let idSubtypeChanged = selectedsIds[j]                                        
                            
        let sql = "INSERT INTO 3a_estoque_utilizavel (id_estoque_utilizavel,fk_id_produto,fk_id_tipo_estoque,fk_id_usuarios_inclusao,data_inclusao_utilizavel, impresso) \
        VALUES(" + last + ", " + id_produto + ", 1," + userId + ", NOW(), 1);"                               
    
        conLocal.query(sql, function (err1, result) {  
            if (err1) throw err1;  

            log_(sql)   

            if(idSubtypeChanged > 0)   
                product.fk_id_subtipo_produto = idSubtypeChanged                    
         
            soldAndPrint(req, product, last)
        });    
    }
}

function soldAndPrint(req, product, last){        

    let userId = req.body.userId
    let userName = req.body.userName
    let finalValue = req.body.finalValue
    let idPayment = req.body.idPayment
    let nome_produto = product.nome_produto        
    let valor_produto = product.valor_produto        
    let data_log_venda = momenttz().tz('America/Sao_Paulo').format("DD.MM.YYYY hh:mm:ss")

    let user = userId
    let obs = "Vendido pelo sistema online"
    let ip = "localhost"
    let validade = 1
    let id_estoque_utilizavel = last
    let fk_id_subtipo_produto = produto.fk_id_subtipo_produto
    let valor = produto.valor_produto
    let id_produto = produto.id_produto
    let fk_id_caixa_venda = produto.fk_id_caixa_venda

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
     + id_estoque_utilizavel + ", " 
     + user + ", "
     + id_produto + ", "
     + fk_id_subtipo_produto + ", "
     + fk_id_caixa_venda + ", " +
     + valor + ", " +
     "NOW(), '" 
     + obs + "', '" 
     + ip + "'," 
     + "'PDVi',"
     + "(SELECT 3a_tipo_pagamento.id_tipo_pagamento FROM 3a_tipo_pagamento WHERE 3a_tipo_pagamento.nome_tipo_pagamento = '" + idPayment + "'),"
     + validade + ");"    

    conLocal.query(sql, function (err, result) {          
        if (err) throw err;                       

        log_(sql)
        printFile(nome_produto, valor_produto, userName, data_log_venda, last, finalValue, 0)
    });        
}

function confirmCashDrain(req, res){

    let idUser = req.body.idUser
    let idSupervisor = req.body.idSupervisor
    let drainValue = req.body.drainValue
                
    let sql = "INSERT INTO 3a_sangria (fk_id_usuario, fk_id_supervisor, data_sangria, valor_sangria) \
        VALUES (" + idUser + ", " + idSupervisor + ", NOW(), " + drainValue + ")";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function confirmCashChange(req, res){

    let idUser = req.body.idUser
    let idSupervisor = req.body.idSupervisor
    let changeValue = req.body.changeValue
                
    let sql = "INSERT INTO 3a_troco (fk_id_usuario, fk_id_supervisor, data_inclusao, valor_inclusao) \
        VALUES (" + idUser + ", " + idSupervisor + ", NOW(), " + changeValue + ")";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getLastCashierId(req, res){

    let idUser = req.body.idUser     

    let sqlCashier = "INSERT INTO 3a_caixa_registrado (fk_id_usuario, data_caixa_registrado, obs_log_venda) \
        VALUES (" + idUser + ", NOW(), 'Gerado pelo sistema PDVi Web');"

    log_(sqlCashier)        

    conLocal.query(sqlCashier, function (err1, result) {        
        if (err1) throw err1;

        let sql = "SELECT 3a_caixa_registrado.id_caixa_registrado \
            FROM 3a_caixa_registrado \
            WHERE 3a_caixa_registrado.fk_id_usuario = " + idUser + " \
            ORDER BY data_caixa_registrado DESC LIMIT 1"
    
        log_(sql)

        conLocal.query(sql, function (err2, resultEnd) {        
            if (err2) throw err2;           
            res.json({"success": resultEnd}); 
        });
    });                       
}

function getTicketOperator(req, res){

    let idUser = req.body.idUser
    let start = req.body.start
    let end = req.body.end    

    let sql = "SELECT *, false AS checked \
            FROM 3a_estoque_utilizavel \
        INNER JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
        INNER JOIN 3a_caixa_registrado ON 3a_caixa_registrado.id_caixa_registrado = 3a_log_vendas.fk_id_caixa_registrado \
        INNER join 3a_produto ON 3a_produto.id_produto = 3a_estoque_utilizavel.fk_id_produto \
        INNER join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_log_vendas.fk_id_subtipo_produto \
        WHERE 3a_log_vendas.fk_id_usuarios = " + idUser + " \
        AND 3a_log_vendas.data_log_venda BETWEEN '" + start + "' AND  '" + end + "' \
        ORDER BY 3a_log_vendas.data_log_venda DESC;"

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getTicketOperatorStr(req, res){

    let idUser = req.body.idUser
    let start = req.body.start
    let end = req.body.end    
    let str = req.body.str

    let sql = "SELECT *, false AS checked \
            FROM 3a_estoque_utilizavel \
        INNER JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
        INNER JOIN 3a_caixa_registrado ON 3a_caixa_registrado.id_caixa_registrado = 3a_log_vendas.fk_id_caixa_registrado \
        INNER join 3a_produto ON 3a_produto.id_produto = 3a_estoque_utilizavel.fk_id_produto \
        INNER join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_log_vendas.fk_id_subtipo_produto \
        WHERE 3a_log_vendas.fk_id_usuarios = " + idUser + " \
        AND 3a_log_vendas.data_log_venda BETWEEN '" + start + "' AND  '" + end + "' \
        AND 3a_estoque_utilizavel.id_estoque_utilizavel = " + str + " \
        ORDER BY 3a_log_vendas.data_log_venda DESC;"

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getTicketsCashier(req, res){

    let idCashier = req.body.idCashier    

    let sql = "SELECT *, false AS checked \
            FROM 3a_estoque_utilizavel \
        INNER JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
        INNER JOIN 3a_caixa_registrado ON 3a_caixa_registrado.id_caixa_registrado = 3a_log_vendas.fk_id_caixa_registrado \
        INNER join 3a_produto ON 3a_produto.id_produto = 3a_estoque_utilizavel.fk_id_produto \
        INNER join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_log_vendas.fk_id_subtipo_produto \
        WHERE 3a_caixa_registrado.id_caixa_registrado = " + idCashier + " \
        ORDER BY 3a_estoque_utilizavel.id_estoque_utilizavel DESC;"

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getTicketParking(req, res){

    let id_estoque_utilizavel = req.body.idTicket
                
    let sql = "SELECT 3a_produto.nome_produto,\
                3a_produto.prefixo_produto,\
                3a_produto.id_produto,\
                3a_produto.valor_produto,\
                3a_log_vendas.data_log_venda,\
                3a_ponto_acesso.nome_ponto_acesso,\
                3a_produto.fk_id_subtipo_produto,\
                3a_estoque_utilizavel.id_estoque_utilizavel,\
                3a_estoque_utilizavel.data_inclusao_utilizavel \
            FROM 3a_estoque_utilizavel \
            LEFT JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
            INNER join 3a_produto ON 3a_produto.id_produto = 3a_estoque_utilizavel.fk_id_produto \
            INNER join 3a_ponto_acesso ON 3a_ponto_acesso.id_ponto_acesso = 3a_estoque_utilizavel.fk_id_ponto_acesso_gerado \
            WHERE id_estoque_utilizavel = " + id_estoque_utilizavel + ";";

    log_(sql)

    
    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getCashDrain(req, res){
    let idUser = req.body.idUser  
    let start = req.body.start
    let end = req.body.end
                
    let sql = "SELECT SUM(valor_sangria)  AS TOTAL \
            FROM 3a_sangria where fk_id_usuario = " + idUser + " \
            AND data_sangria BETWEEN '" + start + "' AND '" + end + "';";
    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getUsers(req, res){
    let sql = "SELECT * FROM 3a_usuarios;";
    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getUsersByName(req, res){

    let name = req.body.name

    let sql = "SELECT * FROM 3a_usuarios WHERE login_usuarios LIKE '%" + name + "%';";
    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
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
        AND datetime BETWEEN '" + start + "' AND '" + end + "';"

    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
});

app.post('/getAllOrdersByCPF', function(req, res) {

    let name = req.body.name
    let start = req.body.start
    let end = req.body.end

    let sql = "SELECT * \
        FROM 3a_vendas_online \
        WHERE _billing_cpf LIKE '%" + name + "%' \
        AND datetime BETWEEN '" + start + "' AND '" + end + "';"

    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
});

app.post('/sendEmail', function(req, res) {    

    let idTicket = req.body.idTicket
    let filename_ = idTicket + '.png'
    let path_ = './qrcodes/' + filename_
    
    generateQrCode(idTicket)

    let emailAddr = req.body.email

    let email = {
        from: emailFrom, 
        to: emailAddr, 
        subject: emailSubject, 
        html:  msgEmail,
        attachments: {filename: filename_, path: path_}
    };

    transporte.sendMail(email, function(err, info){
        if(err)
            throw err;    

        console.log('Email enviado! Leia as informações adicionais: ', info);
        res.json({"success": "true"});
    });    
});

app.post('/printTicket', function(req, res) {    
       
    let userName = req.body.userName
    let finalValue = req.body.finalValue        
    let ticket = req.body.ticket    

    let nome_produto = ticket.nome_produto
    let valor_produto = ticket.valor_produto
    let data_log_venda = ticket.data_log_venda
    let fk_id_estoque_utilizavel = ticket.fk_id_estoque_utilizavel
    
    printFile(nome_produto, valor_produto, userName, data_log_venda, fk_id_estoque_utilizavel, finalValue, 0)
    res.json({"success": "true"});  
});

app.post('/printTicketMultiple', function(req, res) {    
    let tickets = req.body.tickets
    let userName = req.body.userName
    let reprint = req.body.reprint

    for (var i = 0, len = tickets.length; i < len; ++i) {
        
        let ticket = tickets[i]         

        let nome_produto = ticket.nome_produto
        let valor_produto = ticket.valor_produto
        let data_log_venda = ticket.data_log_venda
        let fk_id_estoque_utilizavel = ticket.fk_id_estoque_utilizavel
        let valor_log_venda = ticket.valor_log_venda

        printFile(nome_produto, valor_produto, userName, data_log_venda, fk_id_estoque_utilizavel, valor_log_venda, reprint)
    }
    
    res.json({"success": "true"});  
});

app.post('/printTicketOnline', function(req, res) {    
       
    let userName = req.body.userName
    let finalValue = req.body.finalValue        
    let ticket = req.body.ticket    

    let nome_produto = ticket.nome_produto
    let valor_produto = ticket.valor_produto
    let data_log_venda = ticket.data_log_venda
    let fk_id_estoque_utilizavel = ticket.fk_id_estoque_utilizavel
    
    printFile(nome_produto, valor_produto, userName, data_log_venda, fk_id_estoque_utilizavel, finalValue, 0)
    res.json({"success": "true"});  
});

app.post('/printTicketMultipleOnline', function(req, res) {    
    
    let tickets = req.body.tickets
    let userName = req.body.userName
    let reprint = req.body.reprint

    for (var i = 0, len = tickets.length; i < len; ++i) {
        
        let ticket = tickets[i]         

        let nome_produto = ticket.nome_produto
        let valor_produto = ticket.valor_produto
        let data_log_venda = ticket.data_log_venda
        let fk_id_estoque_utilizavel = ticket.fk_id_estoque_utilizavel
        let valor_log_venda = ticket.valor_log_venda

        printFile(nome_produto, valor_produto, userName, data_log_venda, fk_id_estoque_utilizavel, valor_log_venda, reprint)
    }
    
    res.json({"success": "true"});  
});

app.post('/getAreas', function(req, res) {

    let idTotem = req.body.id

    log_('Totem: '+ idTotem + ' - Verificando informações da areas: ')
            
    let sql = "SELECT 3a_area_venda.* FROM 3a_area_venda;";
    //log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getPaymentsMethods', function(req, res) {

    let idTotem = req.body.id

    log_('Totem: '+ idTotem + ' - Verificando metodos de pagamento: ')
        
    
    let sql = "SELECT 3a_tipo_pagamento.* FROM 3a_tipo_pagamento;";
    //log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getAreasByName', function(req, res) {

    let idTotem = req.body.id
    let name = req.body.name

    log_('Totem: '+ idTotem + ' - Verificando informações da areas por nome: ' + name)
            
    let sql = "SELECT 3a_area_venda.* FROM 3a_area_venda WHERE nome_area_venda LIKE '%" + name + "%';";
    //log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getProductsArea', function(req, res) {

    let idTotem = req.body.id
    let idArea = req.body.idArea

    log_('Totem: '+ idTotem + ' - Verificando produtos da areas: ' + idArea)
            
    let sql = "SELECT 3a_produto.*, \
        0 AS quantity, \
        3a_subtipo_produto.nome_subtipo_produto,\
        0.00 AS valor_total \
        FROM 3a_produto \
        INNER JOIN 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_produto.fk_id_subtipo_produto \
        INNER JOIN 3a_area_venda_produtos ON 3a_area_venda_produtos.fk_id_produto = 3a_produto.id_produto \
        WHERE 3a_area_venda_produtos.fk_id_area_venda = " + idArea + " \
        ORDER BY 3a_produto.posicao_produto_imprimivel ASC;";

    //log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getProductsAreaByName', function(req, res) {

    let idTotem = req.body.id
    let idArea = req.body.idArea
    let name = req.body.name

    log_('Totem: '+ idTotem + ' - Verificando produtos da areas: ' + idArea)
            
    let sql = "SELECT 3a_produto.*, 0 AS quantity, 0.00 AS valor_total \
        FROM 3a_produto \
        INNER JOIN 3a_area_venda_produtos ON 3a_area_venda_produtos.fk_id_produto = 3a_produto.id_produto \
        WHERE 3a_area_venda_produtos.fk_id_area_venda = " + idArea + " \
        AND 3a_produto.nome_produto LIKE '%" + name + "%' \
        ORDER BY 3a_produto.posicao_produto_imprimivel ASC;";

    //log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getSubtypesProducts', function(req, res) {

    let idTotem = req.body.id
    let idProduct = req.body.idProduct

    log_('Totem: '+ idTotem + ' - Verificando subtipos do produto: ' + idProduct)
            
    let sql = "SELECT 3a_subtipo_produto.*, 0 as quantity \
        FROM 3a_subtipo_produto where fk_id_tipo_produto = " + idProduct + ";";

    //log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/payProducts', function(req, res) {    
    payProduct(req, res)
});

app.post('/getAuth', function(req, res) {    
    let email = req.body.email
    let password = req.body.password    
                
    let sql = "SELECT * FROM 3a_usuarios where login_usuarios = '" + email + "' \
        AND senha_usuarios_pdvi = '" + password + "';";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result, "ip": ipAddressLocal}); 
    });
});

app.post('/getAuthSupervisor', function(req, res) {    
                
    let sql = "SELECT * FROM 3a_usuarios \
        INNER JOIN 3a_nivel_acesso ON  3a_nivel_acesso.id_nivel_acesso = 3a_usuarios.fk_id_nivel_acesso \
        where 3a_nivel_acesso.id_nivel_acesso <= 3;";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getTicketParking', function(req, res) {    
    getTicketParking(req, res)    
});

app.post('/getTicketOperator', function(req, res) {
    getTicketOperator(req, res)    
});

app.post('/getTicketOperatorStr', function(req, res) {
    getTicketOperatorStr(req, res)    
});

app.post('/getTicketsCashier', function(req, res) {
    getTicketsCashier(req, res)    
});

app.post('/confirmCashDrain', function(req, res) {    
    confirmCashDrain(req, res)
});

app.post('/confirmCashChange', function(req, res) {    
    confirmCashChange(req, res)
});

app.post('/getCashDrain', function(req, res) {    
    getCashDrain(req, res)
})

app.post('/getCashChange', function(req, res) {    
    let idUser = req.body.idUser 
    let start = req.body.start
    let end = req.body.end   
                
    let sql = "SELECT SUM(valor_inclusao) AS TOTAL \
            FROM 3a_troco where fk_id_usuario = " + idUser + " \
            AND data_inclusao BETWEEN '" + start + "' AND '" + end + "';";
    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
})

app.post('/getTotalTickets', function(req, res) {    
    let idUser = req.body.idUser 
    let start = req.body.start
    let end = req.body.end   
                
    let sql = "SELECT SUM(valor_log_venda) AS TOTAL \
            FROM 3a_log_vendas where fk_id_usuarios = " + idUser + " \
            AND data_log_venda BETWEEN '" + start + "' AND '" + end + "';";
    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
})

app.post('/getLastCashier', function(req, res) {    
    getLastCashierId(req, res)
})

app.post('/getUsers', function(req, res) {    
    getUsers(req, res)    
})

app.post('/getUserByName', function(req, res) {    
    getUsersByName(req, res)    
})

app.post('/changePasswordUser', function(req, res) {    
    let user = req.body.user
    let password = req.body.password    
                
    let sql = "UPDATE 3a_usuarios SET senha_usuarios = '" + password + "', \
        senha_usuarios_pdvi ='" + password + "' WHERE id_usuarios = " + user.id_usuarios + ";";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
})

http.listen(8085);
