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
let shell = require('shelljs');

const synctime = 10000;

const nodemailer = require('nodemailer');
var msgEmail = 'Olá! Obrigado por adquirir o ingresso. Segue em anexo o qrcode. <strong>https://www.megaticket.com.br</strong>'
var emailFrom = 'myrestaurantwebapp@gmail.com'
var emailSubject = 'Qr Code ingresso'
var pathQRCode = './qrcodes/'

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
    host: "10.8.0.50",
    user: "root",
    password: "Mudaragora00",
    database: "zoosp"
};

/*var db_config_local = {
    host: "10.0.2.180",
    user: "root",
    password: "Mudaragora00",
    database: "3access"
};*/

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

    //handleDisconnectRemote();
    handleDisconnectLocal();

    /*setInterval(function(){ 
        syncDatabases()
     }, synctime);*/
    
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

    let cmd = 'sh scripts/impressao.sh "' + tipoIngresso + '" ' + valorIngresso + ' ' + operador + ' "' 
                + dataHora + '" ' + idTicket + ' ' + totalVenda
    
    if(reprint === 1){
        cmd = 'sh scripts/reimpressao.sh "' + tipoIngresso + '" ' + valorIngresso + ' ' + operador + ' "' 
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

function syncDatabases(){
	//log_("Verificando novas vendas")
	
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
    let billing_email;
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
            billing_email = data[i].billing_email
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

                    soldTicket(ticketId, produto, order_total, 1)   

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
        sendEmail(qrcodesTickets, billing_email)
    }, 3000);
}

function soldTicket(produto, tipoPagamento, last, userId){

    let user = userId
    let idCaixa = 1
    let obs = ""
    let ip = "localhost"
    let validade = 1
    let id_estoque_utilizavel = last
    let fk_id_subtipo_produto = produto.fk_id_subtipo_produto
    let valor = produto.valor_produto
    let id_produto = produto.id_produto

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
     + id_estoque_utilizavel + "," 
     + user + ","
     + id_produto + ","
     + fk_id_subtipo_produto + ","
     + idCaixa + "," +
     + valor + "," +
     "NOW(), '" 
     + obs + "', '" 
     + ip + "'," 
     + "'PDVi',"
     + "(SELECT 3a_tipo_pagamento.id_tipo_pagamento FROM 3a_tipo_pagamento WHERE 3a_tipo_pagamento.nome_tipo_pagamento = '" + tipoPagamento + "'),"
     + validade + ");"

    log_(sql)

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

function payProduct(req, res){

    let products = req.body.products

    for (var i = 0, len = products.length; i < len; i++) {
        
        let product = products[i]
        let prefixo = products[i].prefixo_produto
        let prefixo_ini=prefixo*1000000;
        let prefixo_fim=prefixo_ini+999999;
        
        let sql = "SELECT IFNULL(MAX(id_estoque_utilizavel), " + prefixo_ini + ") AS TOTAL \
            FROM 3a_estoque_utilizavel \
            WHERE id_estoque_utilizavel \
            BETWEEN " + prefixo_ini + " \
            AND " + prefixo_fim + ";"        

        log_(sql)    

        conLocal.query(sql, function (err1, result) {  
            if (err1) throw err1;    
                                              
            payProductContinue(req, product, result)
        });
      }
      
      res.json({"success": 1});  
}

function payProductContinue(req, product, data){            

    let id_estoque_utilizavel = data[0].TOTAL        
    
    let userId = req.body.userId
    let userName = req.body.userName
    let finalValue = req.body.finalValue
    let idPayment = req.body.idPayment

    let id_produto = product.id_produto        
    let nome_produto = product.nome_produto        
    let valor_produto = product.valor_produto        

    let quantity = product.quantity

    for(var j = 0; j < quantity; j++){
        
        let last = ++id_estoque_utilizavel
        
        let sql = "INSERT INTO 3a_estoque_utilizavel (id_estoque_utilizavel,fk_id_produto,fk_id_tipo_estoque,fk_id_usuarios_inclusao,data_inclusao_utilizavel, impresso) \
        VALUES(" + last + ", " + id_produto + ", 1," + userId + ", NOW(), 1);"                       

        log_(sql)   
    
        conLocal.query(sql, function (err1, result) {  
            if (err1) throw err1;  

            soldTicket(product, idPayment, last, userId)     
            
            let date = new Date()
            let now = moment(date).format("DD.MM.YYYY kk:mm")       
            
            printFile(nome_produto, valor_produto, userName, now, last, finalValue, 0)
        });    
    }
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
        WHERE _billing_cpf = '" + name + "' \
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
            
    let sql = "SELECT * FROM 3a_subtipo_produto where fk_id_tipo_produto = " + idProduct + ";";

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

    //log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getTicketOperator', function(req, res) {

    let idUser = req.body.idUser
    let start = req.body.start
    let end = req.body.end    

    let sql = "SELECT *, false AS checked \
            FROM 3a_estoque_utilizavel \
        INNER JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
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
});


http.listen(8085);
