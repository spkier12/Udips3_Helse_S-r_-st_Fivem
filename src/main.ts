import * as rs from './rs.ts'


// Adapt EJS engine into OAK for use with view engine
const ej = rs.engineFactory.getEjsEngine()
const ok = rs.adapterFactory.getOakAdapter()


// Create router routes direction and create application
const app = new rs.Application()
const router = new rs.Router()


// Create if not exists database
console.log('Checking database...')

// Delete account table in database
router.get('/api/accountdelete/:id', async(ctx) => {
    const dblogin = new rs.DB(`./config/login.db`)
    dblogin.query(`DROP TABLE ${ctx.params.id}`)
})


// Check if the provided token is valid for login thru own custom verifier
router.get('/api/token/:code/state/:state/password/:pass', async(ctx:any) => {
    const dblogin = new rs.DB(`./config/login.db`)

    const code = ctx.params.code
    const state = ctx.params.state
    const pass0 = ctx.params.pass

    // Try and identify the user who is trying to login
    if (state === 'identify') {
        console.log(`User ${code} Want's to access this site`)

        try {

            let user = null
            let pass1 = null

            // Lookup into database
            for await(const [bruker, passord] of dblogin.query(`SELECT bruker, passord FROM ${code}`)) {
                user = bruker
                pass1 = passord
                break
            }

            // If user and pass that was provided to api is equal to what is in database then accept else deny
            if (user === code && pass0 === pass1) {
                await ctx.render('./views/index.ejs')
            } else {
                await ctx.render('./views/login.ejs')
            }

        } catch {
            console.log('Bruker finnes ikke...')
            await ctx.render('./views/login.ejs')

        }

        // Create a new user with provided data to api
    } else if (state === 'newuser') {
        console.log(`User ${code} wants to create a new user`)

        try {

            dblogin.query(`CREATE TABLE IF NOT EXISTS ${code.toLowerCase()} (bruker varchar(255), passord varchar(255))`)
            dblogin.query(`INSERT INTO ${code.toLowerCase()} VALUES ('${code}', '${pass0}')`)
            await ctx.render('./views/api.ejs', {data: `Brukernavn: ${code} Passord: ${pass0} | Dette skal personen bruke for å logge inn...`})

        } catch(e) {
            console.log(e)
            await ctx.render('./views/api.ejs', {data: e})
        }


    } else if (state === 'passwordchange') {
        console.log(`User ${code} wants to change password for their account`)
        await ctx.render('./views/api.ejs', {data: `User ${code} wants to change password for their account`})

    }
    dblogin.close()
})


// Login thru discord
router.get('/', async(ctx: any) => {
    console.log('Recived GET /')
    await ctx.render(`./views/login.ejs`, {})
})


// Admin web page
router.get('/admin', async(ctx: any) => {
    console.log('Recived GET /admin')
    const db = new rs.DB(`./config/udips.db`)
    const dblogin = new rs.DB(`./config/login.db`)

    var atbdata: string = ""
    var atbdata2: string = ""

    for (const event of db.query(`SELECT name FROM sqlite_master WHERE type ='table' AND name NOT LIKE 'sqlite_%';`)) {
        atbdata += `<option value="${event}">${event}</option>`
    }

    for (const event of dblogin.query(`SELECT name FROM sqlite_master WHERE type ='table' AND name NOT LIKE 'sqlite_%';`)) {
        atbdata2 += `<option value="${event}">${event}</option>`
    }

    await ctx.render(`./views/admin.ejs`, {tb: atbdata, tkonto: atbdata2})
    db.close()
    dblogin.close()
})


// Show profil for a specific user
router.get('/profile/:id', async(ctx: any) => {
    console.log(`Recived GET /profile/${ctx.params.id}`)
    const db = new rs.DB(`./config/udips.db`)
    let user: any = null
    let username: any = null
    let id = 0

    try {

        for (const [ navn, dato, beskrivelse, lagttilav] of db.query(`SELECT navn, dato, beskrivelse, lagttilav FROM ${ctx.params.id.toLowerCase()}`)) {
            id += 1
            user += '<tr><td>' + id + '</td><td>' + navn + '</td>' + '<td>' + dato + '</td><td>' + beskrivelse + '</td><td>' + lagttilav + '</td><td>' + `<button class="btn btn-primary" onclick="slett(${id}, '${ctx.params.id.replaceAll(' ', '_')}')">Slett</button>` + '</td></tr>';
            username = navn
        }
        await ctx.render(`./views/profile.ejs`, {data: user, data2: username, tb: "her var det noe rart"})

    } catch(e) {
        await ctx.render(`./views/update.ejs`, {data: 'Denne Journalen finnes ikke', user: ctx.params.id, tb: "her var det noe rart"})
    }
    db.close()
})


// Render the add information page in iframe
router.get('/profile_new_update', async(ctx: any) => {
    console.log(`Recived GET /profile_new_update`)
    const db = new rs.DB(`./config/udips.db`)

    var atbdata: string = ""

    for (const event of db.query(`SELECT name FROM sqlite_master WHERE type ='table' AND name NOT LIKE 'sqlite_%';`)) {
        atbdata += `<option value="${event}">${event}</option>`
    }
    await ctx.render(`./views/update.ejs`, {data: 'Navn seperert med mellomrom', user: 'Navn seperert med mellomrom', tb: atbdata})
    db.close()
})

// Render the add information page in iframe
router.get('/profile_just_update/:id', async(ctx: any) => {
    console.log(`Recived GET /profile_just_update`)
    await ctx.render(`./views/update1.ejs`, {data: ctx.params.id })
})


// Create user in database
router.get('/profile_new/:name/dato/:dato', async(ctx: any) => {
    console.log(`Recived GET /profile_new/${ctx.params.name}/dato/${ctx.params.dato}`)
    const db = new rs.DB(`./config/udips.db`)


    try {
        db.query(`
        CREATE TABLE IF NOT EXISTS ${ctx.params.name.toLowerCase()} 
        (
            navn varchar(255),
            dato varchar(255), 
            beskrivelse TEXT, 
            lagttilav varchar(255)
        )`);
        
        db.query(`
        INSERT INTO ${ctx.params.name.toLowerCase()} VALUES 
        (
            '${ctx.params.name.toLowerCase().replaceAll(/_/g, ' ')}', 
            '${ctx.params.dato.toLowerCase().replaceAll(/-/g, '/')}', 
            'Kontoen ble lagt til nå', 
            'ingen'
        )`);

        await ctx.render(`./views/redirect_to_profile.ejs`, {data: ctx.params.name})

    } catch(e) {
        await ctx.render(`./views/problem.ejs`, {data: ctx.params.name})
        console.log(e) 
    }
    db.close()
})


// Update user in database
router.get('/profile_update/:name/desc/:desc/addedby/:addedby', async(ctx: any) => {
    console.log(`Recived GET /profile_update/${ctx.params.name}/desc/${ctx.params.desc}/addedby/${ctx.params.addedby}`)
    const db = new rs.DB(`./config/udips.db`)


    try {

        db.query(`
        INSERT INTO ${ctx.params.name.toLowerCase()} VALUES 
        (
            '${ctx.params.name.toLowerCase()}', 
            'Ikke fast satt', 
            '${ctx.params.desc.toLowerCase().replaceAll(/-/g,' ')}', 
            '${ctx.params.addedby.toLowerCase().replaceAll(/-/g,' ')}'
        )`)

        await ctx.render(`./views/redirect_to_profile.ejs`, {data: ctx.params.name})

    } catch(e) {
        await ctx.render(`./views/problem.ejs`, {data: e})
    }
    db.close()
})


router.get('/profile_remove/:name', async(ctx:any) => {
    const db = new rs.DB(`./config/udips.db`)

    try {
        db.query(`DROP TABLE ${ctx.params.name.toLowerCase()}`)
        await ctx.render(`./views/update.ejs`, {data: 'Journal er slettet', user: 'Journal er slettet'})
    } catch(e) {
        await ctx.render(`./views/problem.ejs`, {data: e})
    }
    db.close()
})


//Delete row in user
router.get('/profile_row_delete/:id/user/:user', async(ctx: any) => {
    console.log(`Recived GET /profile_row_delete/${ctx.params.id}/user/${ctx.params.user}`)
    const db = new rs.DB(`./config/udips.db`)

    try {
        db.query(`delete from ${ctx.params.user} where rowid=${ctx.params.id};`)
        await ctx.render(`./views/redirect_to_profile.ejs`, {data: ctx.params.user})
    } catch(e) {
        await ctx.render(`./views/problem.ejs`, {data: e})
    }
    db.close()
})


// A few Oak settings
console.log('Setting Web Server options')
app.use(rs.viewEngine(ok, ej))
app.use(router.routes())
app.use(router.allowedMethods())



// Start web server on certain port
console.log('Udips 3.2 Started...')
await app.listen({ port: 80 })