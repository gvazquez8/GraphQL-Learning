let express = require("express")
let { createHandler } = require("graphql-http/lib/use/express")
let graphql = require("graphql")
let { ruruHTML } = require("ruru/server")

let fakeDb = {}

let messageInputType = new graphql.GraphQLInputObjectType({
    name: "MessageInput",
    fields: {
        content: { type: graphql.GraphQLString },
        author: { type: graphql.GraphQLString },
    },
})

let messageType = new graphql.GraphQLObjectType({
    name: "Message",
    fields: {
        id: { type: new graphql.GraphQLNonNull(graphql.GraphQLID)},
        content: { type: graphql.GraphQLString },
        author: { type: graphql.GraphQLString },
    }
})

let randomDieType = new graphql.GraphQLObjectType({
    name: "RandomDie",
    fields: {
        numSides: { type: new graphql.GraphQLNonNull(graphql.GraphQLInt) },
        rollOnce: { type: graphql.GraphQLInt },
        roll: {
            type: new graphql.GraphQLList(graphql.GraphQLInt),
            args: {
                numRolls: { type: new graphql.GraphQLNonNull(graphql.GraphQLInt) }
            }
        }
    }
})

let mutationType = new graphql.GraphQLObjectType({
    name: "Mutation",
    fields: {
        createMessage: {
            type: messageType,
            args: {
                input: { type: messageInputType }
            },
            resolve: (_, { input }) => {
                let id = require("crypto").randomBytes(10).toString("hex")
                fakeDb[id] = input
                return new Message(id, input)
            }
        },
        updateMessage: {
            type: messageType,
            args: {
                id: { type: new graphql.GraphQLNonNull(graphql.GraphQLID) },
                input: { type: messageInputType }
            },
            resolve: (_, { id, input }) => {
                if (!fakeDb[id]) {
                    throw new Error(`Message with id ${id} not found`)
                }
                fakeDb[id] = input
                return new Message(id, input)
            }
        }
    }
})

let queryType = new graphql.GraphQLObjectType({
    name: "Query",
    fields: {
        getDie: {
            type: randomDieType,
            args: {
                numSides: { type: graphql.GraphQLInt }
            },
            resolve: (_, {numSides}) => new RandomDie(numSides || 6)
        },
        getMessage: {
            type: messageType,
            args: {
                id: { type: new graphql.GraphQLNonNull(graphql.GraphQLID) },
            },
            resolve: (_, { id }) => {
                if (!fakeDb[id]) {
                    throw new Error(`Message with id ${id} not found`)
                }
                return new Message(id, fakeDb[id])
            }
        },
        ip: { 
            type: graphql.GraphQLString,
            resolve: (_, __, context) => context.ip 
        }
    }
})

function loggingMiddleware(req, res, next) {
    console.log("ip", req.ip)
    next()
}

class RandomDie {
    constructor(numSides) {
        this.numSides = numSides
    }

    rollOnce() {
        return 1 + Math.floor(Math.random() * this.numSides)
    }

    roll({ numRolls }) {
        let output = []
        for(let i = 0; i < numRolls; i++) {
            output.push(this.rollOnce())
        }
        return output
    }
}

class Message {
    constructor(id, {content, author}) {
        this.id = id
        this.content = content
        this.author = author
    }
}

let schema = new graphql.GraphQLSchema({ query: queryType, mutation: mutationType })
let app = express()

app.use(loggingMiddleware)
app.all("/graphql",
    createHandler({
        schema: schema,
        context: req => ({ ip: req.raw.ip }),
    })
)

app.listen(4000)

app.get("/", (_req, res) => {
    res.type("html")
    res.end(ruruHTML({ endpoint: "/graphql" }))
})

console.log("Running a GraphQL API server at http://localhost:4000/graphql")