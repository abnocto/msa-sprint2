import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { ApolloGateway, RemoteGraphQLDataSource } from '@apollo/gateway';


const gateway = new ApolloGateway({
  serviceList: [
    { name: 'booking', url: 'http://booking-subgraph:4001' },
    { name: 'hotel', url: 'http://hotel-subgraph:4002' }
  ],
  
  // тут пришлось поменять, иначе не передавался заголовок
  buildService: ({ url }) => new RemoteGraphQLDataSource({
    url,
    willSendRequest({ request, context }) {
      const userId = context.req?.headers['userid'];

      if (userId) {
        request.http.headers.set('userid', userId);
      }
    },
  }),
});

const server = new ApolloServer({ gateway, subscriptions: false });

startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req }) => ({ req }), // headers пробрасываются
}).then(({ url }) => {
  console.log(`🚀 Gateway ready at ${url}`);
});
