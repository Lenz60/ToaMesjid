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
  cobaDulu: path.join(__dirname, "assets", "videos", "cobadulu.mp4"),
  mancing1: path.join(__dirname, "assets", "videos", "mancing.mp4"),
  mancing2: path.join(__dirname, "assets", "videos", "mancing2.mp4"),
  mancing3: path.join(__dirname, "assets", "videos", "mancing3.mp4"),
  maju: path.join(__dirname, "assets", "videos", "maju.mp4"),
  bis: path.join(__dirname, "assets", "videos", "bis.mp4"),
  ojok: path.join(__dirname, "assets", "videos", "ojok.mp4"),
  petasan: path.join(__dirname, "assets", "videos", "petasan.mp4"),
  sederhana: path.join(__dirname, "assets", "videos", "sederhana.mp4"),
  dikejarAyam: path.join(__dirname, "assets", "videos", "dikejarayam.mp4"),
  mangga: path.join(__dirname, "assets", "videos", "mangga.mp4"),
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
  ayam: path.join(__dirname, "assets", "videos", "ayam.mp4"),
};

const gifs = {
  oguriMakan: path.join(__dirname, "assets", "gifs", "ogurimakan.gif"),
};

const getAssetCounts = () => {
  return {
    imagesCount: Object.keys(images).length,
    videosCount: Object.keys(videos).length,
    gifsCount: Object.keys(gifs).length,
  };
};

const assets = {
  images,
  videos,
  gifs,
  getAssetCounts,
};

module.exports = assets;
