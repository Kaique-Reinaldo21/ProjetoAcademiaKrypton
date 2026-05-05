const express = require("express");

const bcrypt = require("bcrypt");

const cors = require("cors");

const mysql = require("mysql2");

const path = require("path");

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "9090",
    database: "sistema_login"
});

connection.connect((err) => {
    if (err) {
        console.error("Erro ao conectar:", err);
    } else {
        console.log("Conectado ao MySQL!");
    }
});

module.exports = connection;

app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000");
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

app.post("/register", async (req, res) => {
    const { usuario, email, senha } = req.body;

    try {
        const senhaHash = await bcrypt.hash(senha, 10);

        const sql = "INSERT INTO usuarios (usuario, email, senha) VALUES (?, ?, ?)";

        connection.query(sql, [usuario, email, senhaHash], (err, result) => {
            if (err) {
                return res.status(500).json(err);
            }

            res.json({ message: "Usuário cadastrado com sucesso!" });
        });

    } catch (error) {
        res.status(500).json(error);
    }
});

app.post("/login", (req, res) => {
    const { email, senha } = req.body;

    const sql = "SELECT * FROM usuarios WHERE email = ?";

    connection.query(sql, [email], async (err, results) => {
        if (err) return res.status(500).json(err);

        if (results.length === 0) {
            return res.status(401).json({ message: "Usuário não encontrado" });
        }

        const user = results[0];

        const senhaValida = await bcrypt.compare(senha, user.senha);

        if (!senhaValida) {
            return res.status(401).json({ message: "Senha incorreta" });
        }

        res.json({ message: "Login realizado com sucesso!" });
    });
});