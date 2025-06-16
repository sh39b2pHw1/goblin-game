import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; // Import Firestore, even if not used for persistence yet

function App() {
  // Game state variables
  const [playerGold, setPlayerGold] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentMonsterHP, setCurrentMonsterHP] = useState(0);
  const [maxMonsterHP, setMaxMonsterHP] = useState(0);
  const [message, setMessage] = useState("Нажми на гоблина, чтобы начать!");
  const [isAuthReady, setIsAuthReady] = useState(false); // State to track Firebase auth readiness
  const [clickDamage, setClickDamage] = useState(1); // New state for player's click damage
  const [upgradeClickCost, setUpgradeClickCost] = useState(10); // Initial cost for click damage upgrade

  // Firebase variables
  const dbRef = useRef(null);
  const authRef = useRef(null);
  const userIdRef = useRef(null);

  // Initialize Firebase and set up auth listener
  useEffect(() => {
    try {
      // Access global variables provided by the Canvas environment
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
      const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

      if (firebaseConfig) {
        const app = initializeApp(firebaseConfig);
        dbRef.current = getFirestore(app);
        authRef.current = getAuth(app);

        // Sign in anonymously or with custom token
        const signIn = async () => {
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(authRef.current, initialAuthToken);
            } else {
              await signInAnonymously(authRef.current);
            }
            console.log("Firebase Auth initialized.");
          } catch (error) {
            console.error("Firebase Auth error:", error);
          }
        };
        signIn();

        // Listen for authentication state changes
        const unsubscribe = onAuthStateChanged(authRef.current, (user) => {
          if (user) {
            userIdRef.current = user.uid;
            console.log("User ID:", userIdRef.current);
          } else {
            // If no user (e.g., anonymous sign-in failed or token expired)
            userIdRef.current = crypto.randomUUID(); // Generate a random ID for unauthenticated users
            console.log("No authenticated user, using random ID:", userIdRef.current);
          }
          setIsAuthReady(true); // Set auth ready after initial check
        });

        return () => unsubscribe(); // Cleanup auth listener on unmount
      } else {
        console.warn("Firebase config not found. Running without Firebase.");
        setIsAuthReady(true); // Still set auth ready for non-Firebase run
      }
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      setIsAuthReady(true); // Ensure game can still start even if Firebase init fails
    }
  }, []);

  // Function to initialize a new monster
  const initializeNewMonster = (level) => {
    const hp = level * 10 + 50; // HP increases with level
    setCurrentMonsterHP(hp);
    setMaxMonsterHP(hp);
    setMessage(`Появился гоблин Ур. ${level}!`);
  };

  // Effect to initialize the first monster when auth is ready
  useEffect(() => {
    if (isAuthReady && maxMonsterHP === 0) { // Only initialize if auth is ready and no monster is set
      initializeNewMonster(currentLevel);
    }
  }, [isAuthReady, currentLevel, maxMonsterHP]);

  // Handle monster click
  const handleMonsterClick = () => {
    if (currentMonsterHP <= 0) {
      // If monster is already defeated, wait for new one to appear
      return;
    }

    const newHP = currentMonsterHP - clickDamage; // Use clickDamage here
    setCurrentMonsterHP(newHP);

    if (newHP <= 0) {
      // Monster defeated!
      const goldEarned = currentLevel * 5; // Earn more gold for higher level monsters
      setPlayerGold(prevGold => prevGold + goldEarned);
      setMessage(`Гоблин повержен! Вы получили ${goldEarned} золота.`);

      // Level up and spawn new monster after a short delay
      setTimeout(() => {
        const nextLevel = currentLevel + 1;
        setCurrentLevel(nextLevel);
        initializeNewMonster(nextLevel);
      }, 1000); // 1 second delay before new monster appears
    }
  };

  // Handle buying upgrades
  const handleBuyClickDamageUpgrade = () => {
    if (playerGold >= upgradeClickCost) {
      setPlayerGold(prevGold => prevGold - upgradeClickCost);
      setClickDamage(prevDamage => prevDamage + 1); // Increase damage by 1
      setUpgradeClickCost(prevCost => Math.floor(prevCost * 1.5)); // Increase cost for next upgrade
      setMessage(`Вы купили Усиленный клик! Урон за клик: ${clickDamage + 1}`);
    } else {
      setMessage("Недостаточно золота для этого улучшения!");
    }
  };

  // Calculate HP bar percentage
  const hpPercentage = maxMonsterHP > 0 ? (currentMonsterHP / maxMonsterHP) * 100 : 0;

  // Show loading while Firebase auth is not ready
  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <p>Загрузка игры...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 text-white font-inter flex flex-col items-center justify-center p-4">
      {/* Game Title */}
      <h1 className="text-5xl md:text-6xl font-bold mb-8 text-yellow-400 drop-shadow-lg text-center">
        Гоблин Кликер
      </h1>

      {/* Game Stats */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-xl mb-8 w-full max-w-md flex flex-col items-center justify-center space-y-4">
        <p className="text-2xl font-semibold">Золото: <span className="text-yellow-300">{playerGold}</span></p>
        <p className="text-2xl font-semibold">Уровень: <span className="text-green-400">{currentLevel}</span></p>
        <p className="text-2xl font-semibold">Урон за клик: <span className="text-purple-400">{clickDamage}</span></p>
        {userIdRef.current && (
            <p className="text-sm text-gray-400 break-all text-center">Ваш ID: {userIdRef.current}</p>
        )}
      </div>

      {/* Monster Area */}
      <div
        className="relative bg-red-800 p-8 rounded-2xl shadow-2xl transition-transform duration-100 active:scale-95 cursor-pointer flex flex-col items-center justify-center transform hover:scale-105"
        onClick={handleMonsterClick}
        style={{ minWidth: '250px', minHeight: '250px' }} // Ensure a minimum size
      >
        <div className="absolute top-4 left-4 right-4 text-center text-xl font-bold">
          Гоблин Ур. {currentLevel}
        </div>
        <p className="text-8xl md:text-9xl mb-4 select-none">🧌</p> {/* Goblin Emoji */}

        {/* HP Bar */}
        <div className="w-full bg-gray-600 rounded-full h-4 mt-2 overflow-hidden border-2 border-red-500">
          <div
            className="bg-red-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${hpPercentage}%` }}
          ></div>
        </div>
        <div className="text-lg font-bold mt-2">{currentMonsterHP} / {maxMonsterHP} HP</div>
      </div>

      {/* Game Message */}
      <div className="bg-blue-800 p-4 rounded-2xl shadow-lg mt-8 w-full max-w-md text-center text-xl font-medium">
        {message}
      </div>

      {/* Upgrade Shop */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-xl mt-8 w-full max-w-md">
        <h2 className="text-3xl font-bold mb-4 text-center text-blue-300">Магазин Улучшений</h2>
        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={handleBuyClickDamageUpgrade}
            className={`w-full py-3 px-6 rounded-xl text-xl font-bold
              ${playerGold >= upgradeClickCost ? 'bg-green-600 hover:bg-green-700 active:bg-green-800' : 'bg-gray-500 cursor-not-allowed'}
              text-white transition-all duration-200 shadow-md transform hover:scale-105`}
            disabled={playerGold < upgradeClickCost}
          >
            Усиленный клик (+1 урон) - {upgradeClickCost} 💰
          </button>
        </div>
      </div>

      {/* Tailwind CSS Script - Always include this in the body or head for HTML/React apps */}
      <script src="https://cdn.tailwindcss.com"></script>
    </div>
  );
}

export default App;
