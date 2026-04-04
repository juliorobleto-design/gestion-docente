import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())
app.use(cookieParser())

app.get("/", (_req, res) => {
  res.send("Backend de Gestión Docente funcionando")
})

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "Servidor backend activo" })
})

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})