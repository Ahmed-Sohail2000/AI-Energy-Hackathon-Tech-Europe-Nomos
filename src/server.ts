import { app } from "./app.js";

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`Nomos Clearing Agent running at http://localhost:${port}`);
});
