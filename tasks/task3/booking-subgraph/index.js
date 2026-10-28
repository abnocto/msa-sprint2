import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import gql from 'graphql-tag';
import { listBookings } from './booking-client.js';
import { GraphQLError } from 'graphql';

const typeDefs = gql`
  type Booking @key(fields: "id") {
    id: ID!
    userId: String!
    hotelId: String!
    promoCode: String
    discountPercent: Int
    hotel: Hotel
  }

  extend type Hotel @key(fields: "id") {
    id: ID! @external
  }

  type Query {
    bookingsByUser(userId: String!): [Booking]
  }

`;

function checkBookingsAccess(req, userId) {
  const requesterId = req.headers['userid'];

  if (!requesterId) {
    throw new GraphQLError('userid header is required', { extensions: { code: 'UNAUTHENTICATED' } });
  }

  if (requesterId !== userId) {
    throw new GraphQLError('Access to bookings of another user is denied', { extensions: { code: 'FORBIDDEN' } });
  }
}

const resolvers = {
  Query: {
    bookingsByUser: async (_, { userId }, { req }) => {
      console.log(`bookingsByUser: userId=${userId}, header userid=${req.headers['userid']}`);
      
      try {
        checkBookingsAccess(req, userId);
      } catch (err) {
        console.log(`bookingsByUser denied: ${err.extensions.code}`);
        throw err;
      }

      const bookings = await listBookings(userId);
      console.log(`bookingsByUser: ${bookings.length} bookings from booking-service`);
      
      return bookings.map((b) => ({
        id: b.id,
        userId: b.user_id,
        hotelId: b.hotel_id,
        promoCode: b.promo_code || null,
        discountPercent: b.discount_percent,
      }));
    },
  },
  Booking: {
    hotel: (booking) => ({ __typename: 'Hotel', id: booking.hotelId }),
  },
};

const server = new ApolloServer({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
});

startStandaloneServer(server, {
  listen: { port: 4001 },
  context: async ({ req }) => ({ req }),
}).then(() => {
  console.log('✅ Booking subgraph ready at http://localhost:4001/');
});
