require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
    const usersCollection = client.db('users').collection('user');

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
      console.log(id);
      const query = { _id: ObjectId(id) };
      const carItem = await carPartsCollection.findOne(query);
      res.send(carItem);
    });

    // displaying all orders
    app.get('/orders', async (req, res) => {
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

    // displaying users
    app.get('/users', async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    // confirming admins account and displaying users for admin
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      res.send({ admin: isAdmin });
    });

    // ordering car parts item
    app.post('/order', async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
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
    app.put('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requestedEmail = req.decoded.email;
      const requestedAccount = await usersCollection.findOne({
        email: requestedEmail,
      });
      if (requestedAccount?.role === 'admin') {
        const filter = { email: email };
        const makeAdmin = {
          $set: { role: 'admin' },
        };

        const adminsResult = await usersCollection.updateOne(filter, makeAdmin);

        res.send(adminsResult);
      } else {
        res
          .status(403)
          .send({ message: 'Access to the this route is forbidden' });
      }
    });
  } finally {
    // await client.close();
  }
};
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server running at http://localhost:${port}`);
});
