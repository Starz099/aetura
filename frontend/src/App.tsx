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

  const handleClick2 = async () => {
    try {
      const response = await fetch('http://localhost:8000/explore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https:google.com',
          intent: 'go to https://starzz.dev/ and summarize the content of the page',
        })
      })
      const data = await response.json()
      console.log(data)
    } catch (error) { console.error('Error sending API call:', error) }
  }

  return (
    <>
      <div>
        <button onClick={() => handleClick()}> Send API call</button>
        AETURA
        <button onClick={() => handleClick2()}> Send Post API call</button>
        AETURA
      </div>
    </>
  )
}

export default App
