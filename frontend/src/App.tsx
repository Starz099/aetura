import { Card, Button } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { useRef } from "react";

function App() {
  const URL = useRef<HTMLInputElement>(null);
  const INTENT = useRef<HTMLInputElement>(null);

  const handleClick = async () => {
    try {
      const response = await fetch("http://localhost:8000/");
      const data = await response.json();
      console.log(data);
    } catch (error) {
      console.error("Error sending API call:", error);
    }
  };

  const handleClick2 = async () => {
    try {
      if (!URL.current || !INTENT.current) return;

      const response = await fetch("http://localhost:8000/explore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: URL.current.value,
          intent: INTENT.current.value,
        }),
      });

      const data = await response.json();
      console.log(data);
    } catch (error) {
      console.error("Error sending API call:", error);
    }
  };

  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Card className="min-w-95 p-10">
          <h1 className="text-center font-bold">Welcome to AETURA</h1>
          enter a URL
          <Input ref={URL} placeholder="Enter URL" defaultValue="https://starzz.dev/" />
          enter an intent prompt
          <Input ref={INTENT} placeholder="Enter intent" defaultValue="hover the navbar links one by one and stop" />

          <Button onClick={handleClick}>Ping</Button>
          <Button onClick={handleClick2}>Start</Button>
        </Card>
      </div>
    </>
  );
}

export default App;
