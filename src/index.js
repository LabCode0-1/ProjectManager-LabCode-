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
    misProyectos: async (_, __, { db, user }) => {  //Ver lista de tareas
      if (!user) { throw new Error('Error de Autenticación, por favor inicie Sesión'); }
      return await db.collection('Project')   
                                .find({ userIds: user._id })
                                .toArray();
    },

    getProyecto: async(_, { id }, { db, user }) => {  
      if (!user) { throw new Error('Error de Autenticación, por favor inicie Sesión'); }
      return await db.collection('Project').findOne({ _id: ObjectId(id) });
    }
  },

//Mutationes
Mutation: {
    signUp: async(root,{input},{db})=>{   //Registrarse
        const hashedPassword=bcrypt.hashSync(input.password) 
        const newUser={ 
            ...input,
            password:hashedPassword,
        }
    const result= await db.collection("user").insertOne(newUser);  
    return{  
        user:newUser,
        token:getToken(newUser),
    }
},

signIn: async(root,{input},{db})=>{    //Iniciar Sesión
    const user = await db.collection('user').findOne({ email: input.email });
    const isPasswordCorrect = user && bcrypt.compareSync(input.password, user.password); 
    if (!user || !isPasswordCorrect) {  
      throw new Error('Credenciales erroneas :('); 
    } 
    return {
      user,
      token: getToken(user), 
    }
  },

createProyectos: async(root,{nombre,objetivosGenerales,objetivosEspecificos,presupuesto,fechaFinal},{db, user})=>{    
    if(!user){console.log("No esta autenticado, por favor inicie sesión.")} //falta poner un segundo condicional para definir que roles pueden cambiar informacion y crearla
    const newProyecto={  
        nombre,
        objetivosGenerales,
        objetivosEspecificos,
        presupuesto,
        fechaInicio: new Date().toISOString(),
        fechaFinal,
        progress:1234,
        userIds:[user._id], 
        userNames: [user.nombre],
        estado:true,
        fase:"en desarrollo",
        Avances: "a veces",//por ahora el campo avances y aspirantes son tomados como strings. 
        Aspirantes:"a programador",
    }
    console.log("Proyecto Creado Correctamente") 
    const result= await db.collection("Project").insertOne(newProyecto); 
    return newProyecto 
},

updateProyectos : async(_, {id, estado }, {db, user}) =>{  
    if(!user){console.log("No esta autenticado, por favor inicie sesión.")}  
    const result= await db.collection("Project") 
                        .updateOne({_id:ObjectId(id) 
                        },{
                            
                            $set:{estado}
                
                        }
    )//IMPORTANTE: Si nuestro proyecto necesita que mas campos sean editables, se deben establecer como argumentos y brindarselos a la funcion desde el front(apollo)
//Si un campo no es editado, es decir, queda en blanco en el front, se puede establecer un if que evalue que si el campo esta en blanco entonces no se ejecuta el update
console.log("Tarea Actualizada Correctamente")
return await db.collection("Project").findOne({_id:ObjectId(id)}); 
},

deleteProyectos : async(_, {id}, {db, user}) =>{   
    if(!user){console.log("No esta autenticado, por favor inicie sesión.")}  

    await db.collection("Project").deleteOne({_id:ObjectId(id)}); 
    console.log("Tarea Eliminada Correctamente")
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

createAvances: async(root,{nombre, proyectosId}, {db, user})=>{
if(!user){console.log("No esta autenticado, por favor inicie sesión.")} 
const newAvances ={
  nombre,
  objGenerales,
  fechaAvance,
  descripcion,
  observaciones,
  proyectosId: ObjectId(proyectosId),
  estado,
  
}
const result= await db.collection("avances").insertOne(newAvances);
return newAvances;
},
/*
updateAvances: async (_, data, {db, user})=>{
  if(!user){console.log("No esta autenticado, por favor inicie sesión.")}  

  const result= await db.collection("avances")
                        .updateOne({_id:ObjectId(data.id)
                        }, {
                          $set: data
                        })
  return await db.collection("Avances").findOne({_id:ObjectId(data.id)});
},
*/


},

//Variables seteadas por defecto 
user:{
id:(root)=>{
    return root._id;}
},


Proyectos: {
    id: ({ _id, id }) => _id || id, 
    progress: async ({_id}, _, {db}) =>{
      const avances= await db.collection("avances").find({proyectosId: ObjectId(_id)}).toArray()
      const completed= avances.filter(avances =>avances.isCompleted);
      if (avances.length===0){
        return 0;
      }
      return (completed.length/avances.length)*100
    },

    users: async ({ userIds }, _, { db }) => Promise.all(  
      userIds.map((userId) => (  
        db.collection('user').findOne({ _id: userId})) 
      )
    ),
   
  },


Avances:{
  id:(root)=>{
    return root._id;},
  Proyecto: async ({proyectosId}, _, {db}) =>(
  await db.collection("Project").findOne({_id:ObjectId(proyectosId)})
  )
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
          user,  //usuario autenticado como contexto
         
        }
      },
    });

    // Metodo listen, servidor iniciado
    server.listen().then(({ url }) => {
    console.log(`🚀  Servidor listo y corriendo en ${url}`);
    });
  }  
start();  


  
  const typeDefs = gql`   
  type Query {
    misProyectos:[Proyectos!]!
    getProyecto:[Proyectos!]!
  }
  
  type user{
      id: ID!
      mail: String!
      identificacion: String!
      nombre: String!
      password: String!
      rol: String!
  } 
    
  type Mutation{
    signUp(input:SignUpInput):AuthUser!
    signIn(input:SignInInput):AuthUser!
    createProyectos(nombre: String!, objetivosGenerales:String!, objetivosEspecificos:String!, presupuesto: String!,fechaFinal: String!):Proyectos!
    updateProyectos(id:ID!, estado:Boolean!):Proyectos!
    deleteProyectos(id:ID!):Boolean!
    #addUserToProyectos(taskListId: ID!, userId: ID!): Proyectos!
    createAvances(nombre:String!,proyectosID:ID!):Avances!
    #updateAvances():Avances!

  }

  input SignUpInput{
    mail: String!
    identificacion: String!
    nombre: String!
    password: String!
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
    estado: Boolean!
    fase: String!
    Avances:String!
    Aspirantes:String!
}



 type Avances{
   id:ID!
   nombre:String!
   objGenerales:String!
   fechaAvance:String!
   descripcion: String!
   observaciones:String!
   Proyecto:[Proyectos]!
   estado:Boolean!

 }


type Aspirante{
    id: ID!
    nombreAspirante: String!
    email: String!
    estado: Boolean!
    fechaIngreso: String!
    FechaEgreso: String!

}
  `;
