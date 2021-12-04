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
      return await db.collection('Proyectos')   
                                .find({ userIds: user._id })
                                .toArray();
    },

    getProyectos: async(_, { id }, { db, user }) => {  
      if (!user) { throw new Error('Error de Autenticación, por favor inicie Sesión'); }
      return await db.collection('TaskList').findOne({ _id: ObjectId(id) });
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

createProyectos: async(root,{nombre},{db, user})=>{    
    if(!user){console.log("No esta autenticado, por favor inicie sesión.")} //falta poner un segundo condicional para definir que roles pueden cambiar informacion y crearla
    const newProyecto={  
        nombre,
        createdAt: new Date().toISOString(),
        userIds:[user._id], 
        userNames: [user.nombre]
    }
    console.log("Proyecto Creado Correctamente") 
    const result= await db.collection("Proyectos").insertOne(newProyecto); 
    return newProyecto 
},

updateProyectos : async(_, {id, title}, {db, user}) =>{  
    if(!user){console.log("No esta autenticado, por favor inicie sesión.")}  
    const result= await db.collection("Proyectos") 
                        .updateOne({_id:ObjectId(id) 
                        },{
                            $set:{title}  
                        }
    )//IMPORTANTE: Si nuestro proyecto necesita que mas campos sean editables, se deben establecer como argumentos y brindarselos a la funcion desde el front(apollo)
//Si un campo no es editado, es decir, queda en blanco en el front, se puede establecer un if que evalue que si el campo esta en blanco entonces no se ejecuta el update
console.log("Tarea Actualizada Correctamente")
return await db.collection("Proyectos").findOne({_id:ObjectId(id)}); 
},

deleteProyecto : async(_, {id}, {db, user}) =>{   
    if(!user){console.log("No esta autenticado, por favor inicie sesión.")}  

    await db.collection("Proyectos").remove({_id:ObjectId(id)}); 
    console.log("Tarea Eliminada Correctamente")
    return true; 
},


addUserToProyectos: async(_, {proyectosId , userId}, {db,user}) =>{  //Permite añadir aspirantes al proyecto 
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

createAvances: async(root,{content, proyectosId}, {db, user})=>{
if(!user){console.log("No esta autenticado, por favor inicie sesión.")} 
const newAvances ={
  content,
  proyectosId: ObjectId(proyectosId),
  isCompleted: false,
}
const result= await db.collection("Avances").insertOne(newAvances);
return newAvances;
},

updateAvances: async (_, data, {db, user})=>{
  if(!user){console.log("No esta autenticado, por favor inicie sesión.")}  

  const result= await db.collection("Avances")
                        .updateOne({_id:ObjectId(data.id)
                        }, {
                          $set: data
                        })
  return await db.collection("Avances").findOne({_id:ObjectId(data.id)});
},



},


user:{
id:(root)=>{
    return root._id;}
},


Proyectos: {
    id: ({ _id, id }) => _id || id, 
    progress: async ({_id}, _, {db}) =>{
      const avances= await db.collection("Avances").find({proyectosId: ObjectId(_id)}).toArray()
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
    todos: async ({_id}, _, {db})=>(
      await db.collection("Avnaces").find({proyectosId:ObjectId(_id)}).toArray()
    ),
  },


Avances:{
  id:(root)=>{
    return root._id;},
  taskList: async ({proyectosId}, _, {db}) =>(
  await db.collection("Proyectos").findOne({_id:ObjectId(proyectosId)})
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
    myTaskLists: [TaskList!]!
    getTaskList(id: ID!): TaskList
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
    createTaskList(title: String!):TaskList!
    updateTaskList(id:ID!, title:String!):TaskList!
    deleteTaskList(id:ID!):Boolean!
    addUserToTaskList(taskListId: ID!, userId: ID!): TaskList
    createToDo(content:String!, taskListId:ID!):ToDo!
    updateToDo(id:ID!,content:String, isCompleted:Boolean):ToDo!
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
    objetivosEspecificos: String
    presupuesto: String!
    fechaInicio: String!
    fechaFinal: String!
    progress: Float!
    users: [user!]!
    Avances:[Avances!]!
}

type Avances{
    id: ID!
    content: String!
    isCompleted: Boolean!
    taskList: TaskList!
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
