// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCpddyEiWIE6VBe5u8JRPYBHlnYRMgljCs",
  authDomain: "niosports-pro.firebaseapp.com",
  databaseURL: "https://niosports-pro-default-rtdb.firebaseio.com",
  projectId: "niosports-pro",
  storageBucket: "niosports-pro.firebasestorage.app",
  messagingSenderId: "669355459084",
  appId: "1:669355459084:web:6c11965f3940bae9c8a429",
  measurementId: "G-0MYGSVVRFT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Initialize services
const database = getDatabase(app);
