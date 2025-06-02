const express = require("express");
const cors = require("cors");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3000;
const SECRET_KEY = "secret1234";

app.use(cors());
app.use(express.json());

let posts = JSON.parse(fs.readFileSync("posts.json", "utf8") || "[]");
let users = JSON.parse(fs.readFileSync("users.json", "utf8") || "[]");

// 저장 함수
const savePosts = () => fs.writeFileSync("posts.json", JSON.stringify(posts, null, 2));
const saveUsers = () => fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

// 회원가입
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "이미 존재하는 사용자입니다." });
  }
  const hashed = bcrypt.hashSync(password, 10);
  users.push({ username, password: hashed, isAdmin: false });
  saveUsers();
  res.json({ success: true });
});

// 로그인
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "로그인 실패" });
  }
  const token = jwt.sign({ username, isAdmin: user.isAdmin }, SECRET_KEY);
  res.json({ token });
});

// 인증 미들웨어
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "토큰 없음" });

  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], SECRET_KEY);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "유효하지 않은 토큰" });
  }
}

// 게시글 조회
app.get("/api/posts", (req, res) => res.json(posts));

// 게시글 작성
app.post("/api/posts", auth, (req, res) => {
  const { title, content } = req.body;
  posts.unshift({
    id: Date.now(),
    title,
    content,
    username: req.user.username,
    likes: 0,
    comments: [],
  });
  savePosts();
  res.json({ success: true });
});

// 게시글 삭제
app.delete("/api/posts/:id", auth, (req, res) => {
  const postId = parseInt(req.params.id);
  const index = posts.findIndex(p => p.id === postId);
  if (index === -1) return res.status(404).json({ error: "게시글 없음" });

  const post = posts[index];
  if (post.username !== req.user.username && !req.user.isAdmin) {
    return res.status(403).json({ error: "권한 없음" });
  }

  posts.splice(index, 1);
  savePosts();
  res.json({ success: true });
});

// 댓글 추가
app.post("/api/posts/:id/comments", auth, (req, res) => {
  const { text } = req.body;
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: "게시글 없음" });

  post.comments.push({ text, user: req.user.username });
  savePosts();
  res.json({ success: true });
});

// 좋아요
app.post("/api/posts/:id/like", auth, (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: "게시글 없음" });

  post.likes++;
  savePosts();
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
