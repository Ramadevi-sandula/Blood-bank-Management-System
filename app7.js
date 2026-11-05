console.log("Blood Bank App Started");
const express = require("express");
const mysql = require("mysql8");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// MySQL Database Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "bloodbank"
});

db.connect((err) => {
    if (err) {
        console.log("Database connection failed:", err.message);
        return;
    }
    console.log("MySQL Database Connected Successfully!");
});

// Home Page
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

// Display Donors
app.get("/donors", (req, res) => {
    db.query("SELECT * FROM donors", (err, result) => {
        if (err) return res.status(500).send(err.message);
        res.json(result);
    });
});

// Insert Donor
app.post("/donors", (req, res) => {
    const { name, age, gender, blood_group, phone } = req.body;

    const sql = `INSERT INTO donors
    (name, age, gender, blood_group, phone)
    VALUES (?, ?, ?, ?, ?)`;

    db.query(sql, [name, age, gender, blood_group, phone], (err, result) => {
        if (err) return res.status(500).send(err.message);
        res.json({ message: "Donor added successfully!" });
    });
});

// Search Donor
app.get("/donors/:donor_id", (req, res) => {
    db.query(
        "SELECT * FROM donors WHERE donor_id = ?",
        [req.params.donor_id],
        (err, result) => {
            if (err) return res.status(500).send(err.message);
            res.json(result);
        }
    );
});

// Update Donor
app.put("/donors/:donor_id", (req, res) => {
    const { name, age, gender, blood_group, phone } = req.body;

    const sql = `UPDATE donors SET
    name=?, age=?, gender=?, blood_group=?, phone=?
    WHERE donor_id=?`;

    db.query(
        sql,
        [name, age, gender, blood_group, phone, req.params.donor_id],
        (err, result) => {
            if (err) return res.status(500).send(err.message);
            res.json({ message: "Donor updated successfully!" });
        }
    );
});

// Delete Donor
app.delete("/donors/:donor_id", (req, res) => {
    db.query(
        "DELETE FROM donors WHERE donor_id=?",
        [req.params.donor_id],
        (err, result) => {
            if (err) return res.status(500).send(err.message);
            res.json({ message: "Donor deleted successfully!" });
        }
    );
});

// Display Blood Stock
app.get("/stock", (req, res) => {
    db.query("SELECT * FROM blood_stock", (err, result) => {
        if (err) return res.status(500).send(err.message);
        res.json(result);
    });
});

// Add Blood Donation
app.post("/donations", (req, res) => {
    const { donor_id, blood_group, units } = req.body;

    if (!donor_id || !blood_group || !units || Number(units) <= 0) {
        return res.status(400).json({ message: "Enter valid donation details." });
    }

    db.query(
        "SELECT * FROM donors WHERE donor_id=? AND blood_group=?",
        [donor_id, blood_group],
        (err, donors) => {
            if (err) return res.status(500).send(err.message);
            if (donors.length === 0) {
                return res.status(400).json({ message: "Donor not found or blood group mismatch." });
            }

            db.query(
                "UPDATE blood_stock SET units_available = units_available + ?, last_updated = CURDATE() WHERE blood_group=?",
                [units, blood_group],
                (err, result) => {
                    if (err) return res.status(500).send(err.message);
                    if (result.affectedRows === 0) {
                        return res.status(400).json({ message: "Blood group not found in stock." });
                    }
                    res.json({ message: "Blood donation recorded successfully!" });
                }
            );
        }
    );
});

// Insert Blood Request
app.post("/requests", (req, res) => {
    const { hospital_name, blood_group, units_required, request_date } = req.body;

    const sql = `INSERT INTO blood_requests
    (hospital_name, blood_group, units_required, request_date)
    VALUES (?, ?, ?, ?)`;

    db.query(
        sql,
        [hospital_name, blood_group, units_required, request_date],
        (err, result) => {
            if (err) return res.status(500).send(err.message);
            res.json({ message: "Blood request submitted successfully!" });
        }
    );
});

// Display Blood Requests
app.get("/requests", (req, res) => {
    db.query("SELECT * FROM blood_requests", (err, result) => {
        if (err) return res.status(500).send(err.message);
        res.json(result);
    });
});

// Issue Blood Request
app.put("/requests/:request_id/issue", (req, res) => {
    const requestId = req.params.request_id;

    db.beginTransaction((err) => {
        if (err) return res.status(500).send(err.message);

        db.query(
            "SELECT * FROM blood_requests WHERE request_id=? AND status='Pending'",
            [requestId],
            (err, requests) => {
                if (err || requests.length === 0) {
                    return db.rollback(() => {
                        res.status(400).json({ message: "Pending request not found." });
                    });
                }

                const request = requests[0];

                db.query(
                    "UPDATE blood_stock SET units_available = units_available - ?, last_updated = CURDATE() WHERE blood_group=? AND units_available >= ?",
                    [request.units_required, request.blood_group, request.units_required],
                    (err, stockResult) => {
                        if (err || stockResult.affectedRows === 0) {
                            return db.rollback(() => {
                                res.status(400).json({ message: "Insufficient blood stock." });
                            });
                        }

                        db.query(
                            "UPDATE blood_requests SET status='Issued' WHERE request_id=?",
                            [requestId],
                            (err) => {
                                if (err) {
                                    return db.rollback(() => {
                                        res.status(500).send(err.message);
                                    });
                                }

                                db.commit((err) => {
                                    if (err) {
                                        return db.rollback(() => {
                                            res.status(500).send(err.message);
                                        });
                                    }
                                    res.json({ message: "Blood issued successfully!" });
                                });
                            }
                        );
                    }
                );
            }
        );
    });
});

// Start Server
app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
