function App() {
  const handleClick = async () => {
    try {
      const response = await fetch('http://localhost:8000/');

      const data = await response.json();
      console.log(data);
    } catch (error) {
      console.error('Error sending API call:', error)
    }
  }
  return (
    <>
      <div>
        <button onClick={handleClick}> Send API call</button>
        AETURA
      </div>
    </>
  )
}

export default App
