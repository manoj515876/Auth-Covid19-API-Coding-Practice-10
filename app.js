const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at port 3000");
    });
  } catch (error) {
    console.log(`DB Error ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    districtId: dbObject.district_id,
    population: dbObject.population,
    districtName: dbObject.district_name,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authenticationToken = (req, res, next) => {
  let jwtToken;
  const authHeaders = req.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfghjkl", async (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// Get Login API

app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const idPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (idPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "asdfghjkl");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

// Get States API

app.get("/states/", authenticationToken, async (req, res) => {
  const getStatesQuery = `SELECT * FROM state ORDER BY state_id;`;
  const dbStates = await db.all(getStatesQuery);
  res.send(
    dbStates.map((eachState) => convertDbObjectToResponseObject(eachState))
  );
});

// Get state API

app.get("/states/:stateId/", authenticationToken, async (req, res) => {
  const { stateId } = req.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const getState = await db.get(getStateQuery);
  res.send(convertDbObjectToResponseObject(getState));
});

// Post districts API

app.post("/districts/", authenticationToken, async (req, res) => {
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const postDistrictsQuery = `
  INSERT INTO
    district (district_name, 
state_id, 
cases, 
cured, 
active,
deaths)
  VALUES
    ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  const player = await db.run(postDistrictsQuery);
  res.send("District Successfully Added");
});

// Get District API

app.get("/districts/:districtId/", authenticationToken, async (req, res) => {
  const { districtId } = req.params;
  const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
  const getDistrict = await db.get(getDistrictQuery);
  res.send(convertDbObjectToResponseObject(getDistrict));
});

// Delete district API

app.delete("/districts/:districtId/", authenticationToken, async (req, res) => {
  const { districtId } = req.params;
  const deleteQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
  await db.run(deleteQuery);
  res.send("District Removed");
});

// Put district API

app.put("/districts/:districtId/", authenticationToken, async (req, res) => {
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const { districtId } = req.params;
  const updatedistrictQuery = `
  UPDATE
    district
  SET
    district_name= '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}

  WHERE
    district_id = ${districtId};`;

  await db.run(updatedistrictQuery);
  res.send("District Details Updated");
});

// Total Cases API

app.get("/states/:stateId/stats/", authenticationToken, async (req, res) => {
  const { stateId } = req.params;
  const getCasesQuery = `SELECT COUNT(district.cases) AS totalCases, COUNT(district.cured) AS totalCured, COUNT(district.active) AS totalActive, COUNT(district.deaths) AS totalDeaths FROM state NATURAL JOIN district WHERE district.state_id = ${stateId};`;
  const casesCount = await db.get(getCasesQuery);
  res.send(casesCount);
});

module.exports = app;
