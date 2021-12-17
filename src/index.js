const { ApolloServer, gql } = require('apollo-server');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
dotenv.config();
const { DB_URI, DB_NAME, JWT_SECRET } = process.env;

//Verificación de Autenticación Por Token
const getToken = (user) => jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30 days' }); //almacenando token desde el user id y la libreria jsonwebtoken

//Creación de Metodo getUserFromToken para las mutaciones que lo requieren
const getUserFromToken = async (token, db) => {
  if (!token) { return null }
  const tokenData = jwt.verify(token, JWT_SECRET); //funcion de la libreria jsonwebtoken
  if (!tokenData?.id) {
    return null;
  }
  
  return await db.collection('user').findOne({ _id: ObjectId(tokenData.id) });  //busca el usuario con el _id igual al que reresa el ObjectId
}


//Resolvers
const resolvers = {
    //Query: {
      //misProyectos: () => []
  //},
  Query: {
    getUsers: async(root,_,{db,user}) =>{
      //if (!user) { throw new Error('Error de Autenticación, por favor inicie Sesión'); }
      //const rol = user.rol 
      //if(rol == "Administrador"){
      return await db.collection('user').find({}).toArray();
      //return userList}else{throw Error("No tiene permisos necesarios para acceder acá")}
    },

    getMyUser:async(root,_,{db,user})=>{
      return await db.collection('user').findOne({_id:user._id})
    },

    misProyectos: async (_, __, { db, user }) => {  //Ver lista de tareas
      //if (!user) { throw new Error('Error de Autenticación, por favor inicie Sesión'); }

      return await db.collection('Project')   
                                .find({})
                                .toArray();
      
    },

    getProyecto: async(_, { Pid }, { db, user }) => {  
      if (!user) { throw new Error('Error de Autenticación, por favor inicie Sesión'); }
      return await db.collection('Project').findOne({ _id: ObjectId(id) });
    },

    //FALTA QUE TRAIGA LOS CAMPOS DE NOMBRE Y ID DEL ESTUDIANTE !!!!
    getEstudiantes: async(_,__,{db,user})=>{
     if (!user) { throw new Error('Error de Autenticación, por favor inicie Sesión'); }
     const rol = user.rol
     if (rol=="Lider"){
       return await db.collection("avances").find({});
     }else{throw Error("sin permisos")}

    },

  },

//Mutationes
Mutation: {
    signUp: async(root,{input},{db})=>{   //Registrarse
        const hashedPassword=bcrypt.hashSync(input.password) 
        const newUser={ 
            ...input,
            estado:"inactivo",
            password:hashedPassword
        }
    const result= await db.collection("user").insertOne(newUser);  
    return{  
        user:newUser,
        token:getToken(newUser),
    }
},

signIn: async(root,{input},{db})=>{    //Iniciar Sesión
    const user = await db.collection('user').findOne({ mail: input.mail });
    const isPasswordCorrect = user && bcrypt.compareSync(input.password, user.password); 
    if (!user || !isPasswordCorrect) {  
      throw new Error('Credenciales erroneas :('); 
    } 
    return {
      user,
      token: getToken(user), 
    }
  },

  editUsuario: async(_,datos,{user,db})=>{
    if(!user){console.log("No esta autenticado, por favor inicie sesión.")}
   const dat={
     ...datos.estado

   }
    const result= await db.collection("user").updateOne({_id:user._id},{$set:dat});
    return await db.collection("user").findOne({_id:user._id});
  },

  editUsuarioAdmin: async(_,{id,estado},{user,db})=>{
    if(!user){console.log("No esta autenticado, por favor inicie sesión.")}
    const rol = user.rol;

   if(rol == "Administrador"){
    const result= await db.collection("user").updateOne({_id:ObjectId(id)},{$set:{estado}});
    return await db.collection("user").findOne({_id:ObjectId(id)})
  }
    else{throw Error("no tiene permisos para modificar esto ")}
  },



createProyectos: async(root,{nombre,objetivosGenerales,objetivosEspecificos,presupuesto,fechaFinal},{db, user})=>{    
    if(!user){console.log("No esta autenticado, por favor inicie sesión.")} //falta poner un segundo condicional para definir que roles pueden cambiar informacion y crearla
    const rol = user.rol
    const newProyecto={  
        nombre,
        objetivosGenerales,
        objetivosEspecificos,
        presupuesto,
        fechaInicio: new Date().toISOString(),
        fechaFinal,
        progress:0,
        userIds:[user._id], 
        userNames: [user.nombre],
        estado:"pendiente",
        fase:"en espera",
        Avances:[],//por ahora el campo avances y aspirantes son tomados como strings. 
        Aspirantes:[]
    }
    if(rol=="Lider"||"Administrador"){
    const result= await db.collection("Project").insertOne(newProyecto); 
    console.log("Proyecto Creado Correctamente") 
    return newProyecto 
    } else{throw new Error("sin permisos necesarios")}
},

updateProyectos : async(_, data, {db, user}) =>{  
    if(!user){console.log("No esta autenticado, por favor inicie sesión.")}  
    const result= await db.collection("Project") 
                        .updateOne({_id:ObjectId(data.id) 
                        },{
                            $set:data
                        }
    )//IMPORTANTE: Si nuestro proyecto necesita que mas campos sean editables, se deben establecer como argumentos y brindarselos a la funcion desde el front(apollo)
//Si un campo no es editado, es decir, queda en blanco en el front, se puede establecer un if que evalue que si el campo esta en blanco entonces no se ejecuta el update
console.log("Proyecto Actualizado Correctamente")
return await db.collection("Project").findOne({_id:ObjectId(id)}); 
},

//ACÁ NO HE PODIDO HACER PARA EDITAR SOLO ESTADO O SOLO FASE, ASÍ QUE OBLIGATORIAMENTE HAY QUE PROVEER AMBAS
updateProyectosAdmin : async(_, data, {db, user}) =>{  
  if(!user){console.log("No esta autenticado, por favor inicie sesión.")}
  const rol= user.rol  
 
  if(rol=="Administrador"){
  const result= await db.collection("Project").updateOne({_id:ObjectId(data.id)},{$set:data})
console.log("Proyecto Actualizado Correctamente")
return await db.collection("Project").findOne({_id:ObjectId(data.id)});}
else{throw Error("Modificaciones no son posibles desde el rol")}
},







deleteProyectos : async(_, {id}, {db, user}) =>{   
    if(!user){console.log("No esta autenticado, por favor inicie sesión.")}  

    await db.collection("Project").deleteOne({_id:ObjectId(id)}); 
    console.log("Proyecto Eliminado Correctamente")
    return true; 
},


/*addUserToProyectos: async(_, {proyectosId , userId}, {db,user}) =>{  //Permite añadir aspirantes al proyecto 
  if(!user){console.log("No esta autenticado, por favor inicie sesión.")}  //Solo usuarios correctamente logueados lo pueden hacer
  const proyectos= await db.collection("Proyectos").findOne({_id:ObjectId(proyectosId)});
  const usuario= await db.collection("user").findOne({_id:ObjectId(userId)});

  if(!proyectos){
    return null; //Cambiar respuesta a su gusto
  }
 
  if(proyectos.userIds.find((dbId) => dbId.toString()=== userId.toString())){
    return proyectos;  
  }
  await db.collection("Proyectos")
          .updateOne({  
          _id:ObjectId(proyectosId)
        }, { 
          $push: {
            userIds: ObjectId(userId),  
            userNames:usuario.nombre,  
          }
        })  
        proyectos.userIds.push(ObjectId(userId))  
        proyectos.userNames.push(usuario.nombre)  
        return proyectos;
},
*/

createAvances: async(root,{descripcion,proyectosId}, {db, user})=>{
if(!user){console.log("No esta autenticado, por favor inicie sesión.")} 
const newAvances ={
  fechaAvance: new Date().toISOString(),
  descripcion,
  observaciones:"null",
}
//const result= await db.collection("avances").insertOne(newAvances)
const results = await db.collection("Project").updateOne({_id:ObjectId(proyectosId)},{$push:{Avances:(newAvances)}})
return newAvances;
},
/*updateAvances: async (_, data, {db, user})=>{
  if(!user){console.log("No esta autenticado, por favor inicie sesión.")}  

  const result= await db.collection("avances")
                        .updateOne({_id:ObjectId(data.id)
                        }, {
                          $set: data
                        })
  return await db.collection("Avances").findOne({_id:ObjectId(data.id)});
},
*/
AddAspirante: async(root,{proyectosId},{db,user})=>{
  const nuevoAspirante={
    userId:user._id,
    userName:user.nombre,
    estado: false,
    fechaIngreso:"indeterminada",
    fechaEgreso: "indeterminada",
    proyectosId:ObjectId(proyectosId)
    
  }
  const results = await db.collection("Project").updateOne({_id:ObjectId(proyectosId)},{$push:{Aspirantes:(nuevoAspirante)}})
  const results2= await db.collection("aspirantes").insertOne(nuevoAspirante);
  return nuevoAspirante
}




},

//Variables seteadas por defecto

aspirantes:{
  
  id:(root)=>{
    return root._id;},

  proyecto: async ({proyectosId}, _, {db}) =>(
    await db.collection("Project").findOne({_id:ObjectId(proyectosId)})
    ),

  user:async(_,{id},{db})=>{
    return await db.collection('aspirantes').find({proyectosId:(ObjectId(id))})

  },


  
  

},



user:{
id:(root)=>{
    return root._id;},

},


Proyectos: {
    id: ({ _id, id }) => _id || id, 
    

    users: async ({ userIds }, _, { db }) => Promise.all(  
      userIds.map((userId) => (  
        db.collection('user').findOne({ _id: userId})) 
      )
    ),

    
    Avances: async({ _id},_,{db})=> {
      return await db.collection("avances").find({Proyecto:ObjectId(_id)})
      
      
    },
  
    /*
    Aspirantes: async({_id},_,{db})=>{
      const aspirantess = await db.collection("aspirantes").findOne({proyecto:ObjectId(_id)})
      if(!aspirantes){
        return(null)
      }return aspirantess


    },
*/    
    
  
   
  },


Avances:{
  id:(root)=>{
    return root._id;},

  proyecto: async ({proyectosId}, _, {db}) =>(
  await db.collection("Project").findOne({_id:ObjectId(proyectosId)})
  ),
  
  id:(root)=>{
    return root._id;}


},

}

const start = async () => {   
    const client = new MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    const db = client.db(DB_NAME);
  
    const server = new ApolloServer({   //Contextos del servidor(necesarios)
      typeDefs, 
      resolvers, 
      context: async ({ req }) => {
        const user = await getUserFromToken(req.headers.authorization, db);
        //console.log(user)
        
        return {
          db,  //base de datos como contexto
          user  //usuario autenticado como contexto
        }
      },
    });

    // Metodo listen, servidor iniciado
    server.listen().then(({ url }) => {
    console.log(`🚀  Servidor listo y corriendo en ${url}`);
    });
  }  
start();  


  
  const typeDefs = gql `
    type Query {
    misProyectos:[Proyectos!]! #historia de usuario 6
    getProyecto(id:ID!):[Proyectos!]!#historia 13. FALTA AUTENTICACION
    getUsers:[user!]! #historia de usuario 4
    getMyUser:user!
    getEstudiantes:aspirantes
  }
  
  type user{
      id: ID!
      mail: String!
      identificacion: String!
      nombre: String!
      password: String!
      estado:String!
      rol: String!
  } 
    
  type Mutation{
    signUp(input:SignUpInput):AuthUser! # historia de usuario 1 
    signIn(input:SignInInput):AuthUser! # historia de usuario 2 
    editUsuario(mail:String, identificacion:String, nombre:String, password:String):user #historia de usuario 3 
    
    editUsuarioAdmin(id:ID!,estado:String!):user! #historia de usuario 5
    updateProyectosAdmin(id:ID!, estado:String, fase:String ):Proyectos! ##hISTORIAS DE USUARIOS 7, 8 Y 9.

    
    #Historia 12 
    createProyectos(nombre: String!, objetivosGenerales:String!, objetivosEspecificos:String!, presupuesto: String!,fechaFinal: String!):Proyectos! 

    updateProyectos(id:ID!, estado:Boolean!):Proyectos!
    deleteProyectos(id:ID!):Boolean!
    #addUserToProyectos(taskListId: ID!, userId: ID!): Proyectos!
    createAvances(descripcion:String!, proyectosId:ID!):Avances!
    #updateAvances():Avances!

    AddAspirante(proyectosId:ID!):aspirantes!

  }

  
  

  input SignUpInput{
    mail: String!
    identificacion: String!
    nombre: String!
    password: String!
    estado:String!
    rol: String!
  }

  input SignInInput{
    mail: String!
    password: String!
  }

  type AuthUser{
      user:user!
      token: String!
  }

  type Proyectos{
    id: ID!
    nombre: String!
    objetivosGenerales: String!
    objetivosEspecificos: String!
    presupuesto: String!
    fechaInicio: String!
    fechaFinal: String!
    progress: Float!
    users: [user!]!
    estado: String!
    fase: String!
    Avances:[Avances]
    aspirantes:[aspirantes]
  }

 type Avances{
   id:ID!
   fechaAvance:String!
   descripcion: String!
   observaciones:String! #[Observaciones!]!
   proyecto:[Proyectos!]!

 }

 type Observaciones{
   id:ID!
   avances:Avances!
   contenido:String!
 }


type aspirantes{
  id:ID!
  user:user!
  estado: String
  fechaIngreso: String
  fechaEgreso: String
  proyecto:Proyectos!

}
  `;
