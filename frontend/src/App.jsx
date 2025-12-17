import { useState } from 'react' 
import React from 'react';
import {BrowserRouter as Router ,Routes ,Route} from 'react-router-dom';
import './App.css'
import Login from './pages/user-login/Login';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


function App() {
   

  return (
    <>
    <ToastContainer position='top-right' autoClose={3000}/>
     <Router>
      <Routes>
        <Route path='/user-login' element={<Login/>} />
      </Routes>
     </Router>
     </>
  )
}

export default App
