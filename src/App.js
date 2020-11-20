import React, { useEffect, useRef, useState } from 'react';
import './App.css';

import firebase from 'firebase/app';
import 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';

import 'emoji-mart/css/emoji-mart.css';
import { Picker } from 'emoji-mart';

import gsap from 'gsap';

import gifsData from './gifsData';

require('dotenv').config();

const GifPlayer = require('react-gif-player');
let emojiAnims = [];

const MESSAGES_TO_FETCH = 50;

firebase.initializeApp({
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
});

const firestore = firebase.firestore();

function App() {
  return <ChatRoom />;
}

let playerTimeline = gsap.timeline();

function ChatRoom() {
  const player = useRef();
  const canvasRef = useRef(null);
  const pickerRef = useRef(null);
  const [gif, setGif] = useState('');
  const [gifPlaying, setGifPlaying] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const messagesRef = firestore.collection('messages');
  const query = messagesRef.orderBy('createdAt', 'desc').limit(MESSAGES_TO_FETCH);

  const [messages] = useCollectionData(query, { idField: 'id' });
  let filteredMessages = [];

  if (messages) {
    const now = new Date();
    now.setSeconds(now.getSeconds() - 1);
    const justSelected = new Date(now.getTime());

    now.setSeconds(now.getSeconds() - 3);
    const inMinute = new Date(now.getTime());

    filteredMessages = messages.filter(message => {
      const result =
        message.createdAt && new Date(message.createdAt.seconds * 1000).getTime() >= justSelected.getTime();
      return result;
    });

    const inMinuteMessages = messages.filter(message => {
      const result = message.createdAt && new Date(message.createdAt.seconds * 1000).getTime() >= inMinute.getTime();
      return result;
    });

    const obj = {};
    inMinuteMessages.forEach(message => {
      if (!(message.name in obj)) {
        obj[message.name] = [];
      }
      obj[message.name].push(message);
    });

    let topRank = [];
    Object.keys(obj).forEach(function (key) {
      if (topRank === null || topRank.length < obj[key].length) {
        topRank = obj[key];
      }
    });

    if (topRank.length >= 5 && !gifPlaying && !playerTimeline.isActive()) {
      const gifName = topRank[0].name;
      const gifData = gifsData[gifName];
      if (gifData && player.current) {
        setGif(`/gif/${gifName}.gif`);
        setGifPlaying(true);

        const duration = Math.max(gifData.duration * 1.2, 4000);

        if (playerTimeline !== null) {
          playerTimeline.kill();
        }

        playerTimeline = gsap.timeline();
        playerTimeline.to('.gifPlayer', { duration: 0.4 }, {});
        playerTimeline.to('.gifPlayer', {
          top: 0,
          duration: 1.0,
          ease: 'bounce.out'
        });
        playerTimeline.to('.gifPlayer', { duration: duration / 1000 }, {});
        playerTimeline.to('.gifPlayer', {
          top: '-1000px',
          duration: 0.8,
          ease: 'back.inOut'
        });
        playerTimeline.to('.gifPlayer', { duration: 5 }, {});

        playerTimeline.then(() => {
          setGif('');
          setGifPlaying(false);
        });
      }
    }
  }

  const onSelectEmoji = async emoji => {
    await messagesRef.add({
      name: emoji.id,
      text: emoji.native,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  };

  useEffect(() => {
    if (canvasRef.current && filteredMessages && filteredMessages.length) {
      // Text size
      const sizeBasis = Math.max(Math.floor(window.innerWidth * 0.07), 80);
      const sizeOffset = Math.floor(sizeBasis * 0.15);
      const size = Math.floor(Math.random() * sizeBasis) + sizeOffset;

      const message = filteredMessages[0].text;

      // Position X
      const widthOffset = window.innerWidth * 0.1;
      const baseWidth = window.innerWidth - widthOffset * 2;
      const xPos = Math.floor(Math.random() * baseWidth) + widthOffset - size / 2;

      // Position Y
      const pickerHeight = showPicker ? pickerRef.current.clientHeight : 0;
      const emptyAreaHeight = window.innerHeight - pickerHeight - size;
      const randomPosY = Math.floor(Math.random() * emptyAreaHeight) + size / 2;

      const params = {
        message,
        x: xPos,
        y: -100,
        duration: 0,
        ease: '',
        size,
        completed: false
      };
      emojiAnims.push(params);

      const tl = gsap.timeline();
      tl.to(params, {
        x: xPos,
        y: randomPosY,
        duration: 0.5,
        ease: 'expo.out',
        size
      });
      tl.to({}, { duration: 1.8 }, {});
      tl.to(params, {
        y: window.innerHeight + sizeBasis * 2,
        duration: 1.0,
        ease: 'back.inOut'
      }).then(() => {
        params.completed = true;
      });
    }
  }, [canvasRef, filteredMessages, showPicker]);

  useEffect(() => {
    gsap.to('.emojiPicker', { bottom: '-500px', duration: 0.5, ease: 'expo.inOut', delay: 1 });
    gsap.ticker.add(() => {
      if (canvasRef && canvasRef.current && emojiAnims.length) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        const offscreen = document.createElement('canvas');
        offscreen.width = canvasRef.current.width;
        offscreen.height = canvasRef.current.height;
        const offscreenCtx = offscreen.getContext('2d');

        emojiAnims.forEach(params => {
          offscreenCtx.font = `${Math.floor(params.size)}px serif`;
          offscreenCtx.fillText(params.message, Math.floor(params.x), Math.floor(params.y));
        });

        ctx.drawImage(offscreen, 0, 0);

        if (!playerTimeline.isActive()) {
          const completed = emojiAnims.filter(({ completed }) => !!completed);
          if (completed.length === emojiAnims.length) {
            emojiAnims = [];
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      }
    });
  }, []);

  const onTapCanvas = () => {
    const visible = !showPicker;
    setShowPicker(visible);

    if (visible) {
      gsap.to('.emojiPicker', { bottom: 0, duration: 0.5, ease: 'back.inOut' });
    } else {
      gsap.to('.emojiPicker', { bottom: '-500px', duration: 0.5, ease: 'expo.inOut' });
    }
  };

  return (
    <>
      <GifPlayer ref={player} autoplay={true} className="gifPlayer" gif={gif} />
      <canvas
        onClick={onTapCanvas}
        className="canvasArea"
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
      />
      <div ref={pickerRef} id="picker" className="emojiPicker">
        <Picker set="apple" onSelect={onSelectEmoji} showPreview={false} showSkinTones={false} />
      </div>
    </>
  );
}

export default App;
