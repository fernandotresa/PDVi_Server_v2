let mysql = require('mysql');
let express =  require('express');
let app = express();
let http = require('http').Server(app);
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
    password: "bilheteria",
    database: "bilheteria"
 });

 con.connect(function(err) {
    if (err) throw err;
	log_("Database conectado!")		    
    log_("Aguardando conexões ...")	
});

function log_(str){
    console.log(str)
}

app.post('/getUsers', function(req, res) {

    //let email = req.body.email

    let sql = "SELECT \
        p.ID as order_id,\
        p.post_date,\
        max( CASE WHEN pm.meta_key = '_billing_email' and p.ID = pm.post_id THEN pm.meta_value END ) as billing_email,\
        max( CASE WHEN pm.meta_key = '_billing_phone' and p.ID = pm.post_id THEN pm.meta_value END ) as billing_phone,\
        max( CASE WHEN pm.meta_key = '_billing_first_name' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_first_name,\
        max( CASE WHEN pm.meta_key = '_billing_last_name' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_last_name,\
        max( CASE WHEN pm.meta_key = '_order_total' and p.ID = pm.post_id THEN pm.meta_value END ) as order_total,\
        max( CASE WHEN pm.meta_key = '_order_tax' and p.ID = pm.post_id THEN pm.meta_value END ) as order_tax,\
        max( CASE WHEN pm.meta_key = '_paid_date' and p.ID = pm.post_id THEN pm.meta_value END ) as paid_date,\
        max( CASE WHEN p.ID = wptr.object_id THEN wptr.term_taxonomy_id END ) as status \
    FROM \
        wp_posts as p,\
        wp_postmeta as pm,\
        wp_term_relationships as wptr \
    WHERE \
        p.ID = pm.post_id \
    GROUP BY \
        p.ID"

    log_(sql)

    con.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
});


http.listen(8085);
