const { ApolloServer, gql } = require('apollo-server');
const dotenv=require("dotenv")
const { MongoClient } = require('mongodb');
dotenv.config();
const {DB_URI,DB_NAME}=process.env;
const bcrypt=require("bcryptjs")



  // Los resolvers definen la técnica para obtener los tipos definidos en el
// esquema. Este solucionador recupera misProyectos de la matriz "misProyectos" definida en la linea 65 .
const resolvers = {
    Query: {
      misProyectos: () => []
  },
//Mutationes, no comprendi del todo como funcionan, pero por ejemplo esta ayuda a encriptar la contraseña del usuario
Mutation: {
    singUp: async(root,{input},{db})=>{
        const hashedPassword=bcrypt.hashSync(input.password)
        const newUser={
            ...input,
            password:hashedPassword,
        }
    const result= await db.collection("user").insertOne(newUser);
    //Funcion asincrona que puede recibir 3 argumentos y regresa un objeto
    const user=result.ops[0]
    return{
        user,
        token:"token",
    }
}
},
user:{
id:(root)=>{
    return root.Id;
}
}
}
  // El constructor de ApolloServer requiere dos parámetros: su esquema
// y su conjunto de resolvers.
  
  const start= async() =>{
    const client = new MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    const db=client.db(DB_NAME)

    const context={
        db,
    }

    const server = new ApolloServer({ typeDefs, resolvers, context });

    // El metodo`listen` lanza el web server.
    server.listen().then(({ url }) => {
    console.log(`🚀  Server ready at ${url}`);
    });
  }  
start();


  // Un esquema es una colección de definiciones de tipos ( "typeDefs")
// que en conjunto definen la "forma" de las consultas que se ejecutan en
// tu información.
  const typeDefs = gql`
  type Query{
      misProyectos:[proyectos!]!
  }
  
  type user{
      id: ID!
      mail: String!
      identificacion: String!
      nombre: String!
      password: String!
      rol: String!
  } 
  
  type proyectos{
      id: ID!
      nombre: String!
      objGenerales: String!
      objEspecicos: String!
      prespuesto: String!
      fechain: String!
      fechafi: String!
      user:[user!]!
  }
  
  type Mutation{
    singUp(input:SingUpInput):AuthUser!
  }
  input SingUpInput{
    mail: String!
    identificacion: String!
    nombre: String!
    password: String!
    rol: String!
  }
  type AuthUser{
      user:user!
      token: String!
  }
  `;