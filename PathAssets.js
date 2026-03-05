const path = require("path");

const images = {
  lapar: path.join(__dirname, "assets", "images", "lapar.jpg"),
  puasaGaSih: path.join(__dirname, "assets", "images", "lupuasagasi.png"),
  himariMokel: path.join(__dirname, "assets", "images", "himari.png"),
};

const videos = {
  bukaJamBerapa: path.join(
    __dirname,
    "assets",
    "videos",
    "bukapuasajamberapayah.mp4"
  ),
  esBuah: path.join(__dirname, "assets", "videos", "esbuah.mp4"),
  esTeh: path.join(__dirname, "assets", "videos", "estehcalling.mp4"),
  cokA: path.join(__dirname, "assets", "videos", "coka.mp4"),
  ashadu: path.join(__dirname, "assets", "videos", "ashadu.mp4"),
  bahlil: path.join(__dirname, "assets", "videos", "bahlil.mp4"),
  kueNiga: path.join(__dirname, "assets", "videos", "kueNiga.webm"),
  wahyuDibadog: path.join(__dirname, "assets", "videos", "maswahyu.webm"),
  waktunyaBuka: path.join(__dirname, "assets", "videos", "waktunyabuka.webm"),
  hariIniAkuMokel: path.join(
    __dirname,
    "assets",
    "videos",
    "hariiniakumokel.webm"
  ),
  bukaGes: path.join(__dirname, "assets", "videos", "bukages.mp4"),
  sahur1: path.join(__dirname, "assets", "videos", "sahur.mp4"),
  sahur2: path.join(__dirname, "assets", "videos", "sahur2.mp4"),
};

const gifs = {
  oguriMakan: path.join(__dirname, "assets", "gifs", "ogurimakan.gif"),
};

const assets = {
  images,
  videos,
  gifs,
};

module.exports = assets;
