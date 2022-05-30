require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('HELLO THERE!!');
});

// verifying JWT
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res
      .status(401)
      .send({ message: 'Access to this route is unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .send({ message: 'Access to this route is forbidden' });
    }
    req.decoded = decoded;
    console.log('decoded ', decoded);
    console.log('Auth header ', authHeader);
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_AUTHOR}:${process.env.DB_PASSWORD}@cluster0.cvx4k.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    await client.connect();
    const carPartsCollection = client.db('carParts').collection('carPart');
    const ordersCollection = client.db('carParts').collection('orders');
    const partnersCollection = client.db('carParts').collection('partners');
    const servicesCollection = client.db('carParts').collection('services');
    const usersCollection = client.db('users').collection('user');
    const reviewsCollection = client.db('users').collection('reviews');
    const paymentsCollection = client.db('users').collection('payments');
    const profileCollection = client.db('portfolio').collection('myProfile');

    // verifying admin
    const verifyAdmin = async (req, res, next) => {
      const requestedEmail = req.decoded.email;
      const requestedAccount = await usersCollection.findOne({
        email: requestedEmail,
      });
      if (requestedAccount?.role === 'admin') {
        next();
      } else {
        res.status(403).send({
          message: 'Request to the this route is not accessible and deniable',
        });
      }
    };

    // displaying connect partnets
    app.get('/partners', async (req, res) => {
      const query = {};
      const partnerImages = await partnersCollection.find(query).toArray();
      res.send(partnerImages);
    });

    // displaying services
    app.get('/services', async (req, res) => {
      const query = {};
      const services = await servicesCollection.find(query).toArray();
      res.send(services);
    });

    // displaying all the car parts
    app.get('/car-parts', async (req, res) => {
      const query = {};
      const cursor = carPartsCollection.find(query);
      const carParts = await cursor.toArray();
      res.send(carParts);
    });

    // displaying single car part for purchase
    app.get('/car-parts/:carItemId', async (req, res) => {
      const id = req.params.carItemId;
      // console.log(id);
      const query = { _id: ObjectId(id) };
      const carItem = await carPartsCollection.findOne(query);
      res.send(carItem);
    });

    // displaying all reviews
    app.get('/reviews', async (req, res) => {
      const query = {};
      const reviews = await reviewsCollection.find(query).toArray();
      res.send(reviews);
    });

    // displaying all orders
    app.get('/orders', verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const orders = await ordersCollection.find(query).toArray();
      res.send(orders);
    });

    // displaying orders by email
    // using verifyJWT as middleware
    app.get('/order', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const user = req.query.user;
      if (user === decodedEmail) {
        const query = { user: user };
        const cursor = ordersCollection.find(query);
        const ordersResult = await cursor.toArray();
        res.send(ordersResult);
      } else {
        res.status(403).send({ message: 'Access to this route is forbidden' });
      }
    });

    // displaying order by id for purchase car item
    app.get('/order/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: ObjectId(id) };
      const order = await ordersCollection.findOne(query);
      res.send(order);
    });

    // displaying users
    app.get('/users', async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    // displaying user profile
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const profile = await usersCollection.findOne(query);
      res.send(profile);
    });

    // confirming admins account and displaying users for admin
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      res.send({ admin: isAdmin });
    });

    // displaying portfolio
    app.get('/portfolio', async (req, res) => {
      const query = {};
      const portfolio = await profileCollection.find(query).toArray();
      res.send(portfolio);
    });

    // adding new car part accessory to database
    app.post('/car-part', verifyJWT, async (req, res) => {
      const carPartAccessory = req.body;
      const carPartAccessoryResult = await carPartsCollection.insertOne(
        carPartAccessory
      );
      res.send(carPartAccessoryResult);
    });

    // ordering car parts item
    app.post('/order', async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    // ordering car parts item
    app.post('/reviews', async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });

    // create payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const order = req.body;
      const price = order?.price;
      const amount = price * 100;
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // updating available quantity for car item
    app.put('/car-parts/:carItemId', async (req, res) => {
      const id = req.params.carItemId;
      const availableQuantity = req.body;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateAvailableQuantity = {
        $set: {
          avaialableQuantity: availableQuantity.avaialableQuantity,
        },
      };
      const availableQuantityResult = await carPartsCollection.updateOne(
        filter,
        updateAvailableQuantity,
        options
      );

      res.send(availableQuantityResult);
    });

    // issuing JWT during signin or signup or social login
    // inserting user to database if user does not exist
    // updating user email if does exist
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateUser = {
        $set: user,
      };
      const usersResult = await usersCollection.updateOne(
        filter,
        updateUser,
        options
      );
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: '1d',
        }
      );
      res.send({ usersResult, accessToken: token });
    });

    // creating adminRole for from users to admins
    // using verifyJWT as middleware
    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const makeAdmin = {
        $set: { role: 'admin' },
      };
      const adminResult = await usersCollection.updateOne(filter, makeAdmin);
      res.send(adminResult);
    });

    // update transaction of order
    app.patch('/order/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateOrderPayment = {
        $set: {
          paid: true,
          status: 'pending',
          transactionId: payment?.transactionId,
        },
      };

      const resultPayments = await paymentsCollection.insertOne(payment);
      const updatedOrderPayment = await ordersCollection.updateOne(
        filter,
        updateOrderPayment
      );
      res.send(updateOrderPayment);
    });

    // update payment status
    app.put('/order/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const shipOrder = {
        $set: { status: 'shipped' },
      };
      const shipOrderResult = await ordersCollection.updateOne(
        filter,
        shipOrder,
        options
      );
      res.send(shipOrderResult);
    });

    // delete order by user
    app.delete('/order/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await ordersCollection.deleteOne(filter);
      res.send(result);
    });

    // delete car part accessory by admin
    app.delete('/car-parts/:carItemId', async (req, res) => {
      const id = req.params.carItemId;
      const filter = { _id: ObjectId(id) };
      const result = await carPartsCollection.deleteOne(filter);
      res.send(result);
    });
  } finally {
    // await client.close();
  }
};
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server running at http://localhost:${port}`);
});
