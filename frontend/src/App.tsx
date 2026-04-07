import { Card, Button } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";

interface DOMElement {
  element_id: number;
  element_type: string;
  text: string;
  href?: string;
}

interface Action {
  tool_name: string;
  arguments: any;
  description: string;
}

interface Step {
  step_number: number;
  current_url: string;
  action_taken: Action;
  available_elements: DOMElement[];
}

interface DemoScript {
  goal: string;
  starting_url: string;
  steps: Step[];
}

function App() {
  const URL = useRef<HTMLInputElement>(null);
  const INTENT = useRef<HTMLInputElement>(null);

  const [scriptData, setScriptData] = useState<DemoScript | null>(null);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPathBroken, setIsPathBroken] = useState(false);

  // NEW: States for the recording engine
  const [isRecording, setIsRecording] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

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

      setLoading(true);
      setIsPathBroken(false);
      setFinalVideoUrl(null); // Clear any previous videos

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

      const rawData = await response.json();
      const actualScriptData: DemoScript = rawData.agent_message ? rawData.agent_message : rawData;
      setScriptData(actualScriptData);
    } catch (error) {
      console.error("Error sending API call:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResumeScript = async () => {
    if (!scriptData) return;

    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/explore/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: scriptData.starting_url,
          intent: scriptData.goal,
          approved_steps: scriptData.steps,
        }),
      });

      const rawData = await response.json();
      const actualScriptData: DemoScript = rawData.agent_message ? rawData.agent_message : rawData;

      setScriptData(actualScriptData);
      setIsPathBroken(false);
    } catch (error) {
      console.error("Error resuming script:", error);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Function to trigger the Playwright screen recorder
  const handleRecordScript = async () => {
    if (!scriptData) return;

    setIsRecording(true);
    setFinalVideoUrl(null); // Clear previous video if any

    try {
      const response = await fetch("http://localhost:8000/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: scriptData.starting_url,
          approved_steps: scriptData.steps,
        }),
      });

      const data = await response.json();

      // Save the video URL to state!
      if (data.status === "success") {
        setFinalVideoUrl(data.video_url);
      }
    } catch (error) {
      console.error("Error recording video:", error);
    } finally {
      setIsRecording(false);
    }
  };

  const handleLoadMock = async () => {
    try {
      const response = await fetch("http://localhost:8000/dev/load-cache");
      const rawData = await response.json();

      if (rawData.error) {
        console.error(rawData.error);
        alert("No cache found. Run a real Start Mapping first.");
        return;
      }

      const actualScriptData: DemoScript = rawData.agent_message ? rawData.agent_message : rawData;
      setScriptData(actualScriptData);
      setIsPathBroken(false);
      setFinalVideoUrl(null);
    } catch (error) {
      console.error("Error loading mock data:", error);
    }
  };

  const handleElementChange = (stepIndex: number, newElementId: string) => {
    if (!scriptData) return;

    const currentStep = scriptData.steps[stepIndex];
    const selectedElement = currentStep.available_elements.find(
      (el) => el.element_id === parseInt(newElementId)
    );

    if (!selectedElement) return;

    const updatedSteps = [...scriptData.steps];

    updatedSteps[stepIndex].action_taken = {
      tool_name: updatedSteps[stepIndex].action_taken.tool_name,
      arguments: { element_id: selectedElement.element_id },
      description: `Swapped target to: ${selectedElement.text}`,
    };

    const slicedSteps = updatedSteps.slice(0, stepIndex + 1);

    setScriptData({ ...scriptData, steps: slicedSteps });
    setIsPathBroken(true);
    setEditingStepIndex(null);
  };

  const renderStepDescription = (step: Step) => {
    const { tool_name, arguments: args, description } = step.action_taken;

    if (description.startsWith("Swapped")) {
      return (
        <div className="flex items-center gap-2 mt-1">
          <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded uppercase">EDITED</span>
          <span className="text-slate-700 font-medium">{description.replace("Swapped target to: ", "")}</span>
        </div>
      );
    }

    const formattedTool = tool_name.split('_')[0].toUpperCase();
    let targetDetails = "";

    if (tool_name === "click_element" || tool_name === "hover_element") {
      const targetElement = step.available_elements.find((el) => el.element_id === args?.element_id);
      targetDetails = targetElement ? `"${targetElement.text}"` : `Element ID: ${args?.element_id}`;
    } else if (tool_name === "goto_url") {
      targetDetails = args?.url || "";
    } else if (tool_name === "type_text") {
      const targetElement = step.available_elements.find((el) => el.element_id === args?.element_id);
      const elName = targetElement ? `"${targetElement.text}"` : `ID ${args?.element_id}`;
      targetDetails = `Typed "${args?.text}" into ${elName}`;
    } else if (tool_name === "scroll_page") {
      targetDetails = `Direction: ${args?.direction || 'down'}`;
    } else if (tool_name === "finish_task") {
      targetDetails = "Goal accomplished!";
      return (
        <div className="flex items-center gap-2 mt-1">
          <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded tracking-wider">FINISH</span>
          <span className="text-slate-700 font-medium truncate max-w-[400px]">{targetDetails}</span>
        </div>
      );
    }

    let badgeColor = "bg-slate-200 text-slate-800";
    if (formattedTool === "CLICK") badgeColor = "bg-blue-100 text-blue-800";
    if (formattedTool === "HOVER") badgeColor = "bg-purple-100 text-purple-800";
    if (formattedTool === "GOTO") badgeColor = "bg-emerald-100 text-emerald-800";
    if (formattedTool === "TYPE") badgeColor = "bg-amber-100 text-amber-800";

    return (
      <div className="flex items-center gap-2 mt-1">
        <span className={`${badgeColor} text-xs font-bold px-2 py-1 rounded tracking-wider`}>
          {formattedTool}
        </span>
        <span className="text-slate-700 font-medium truncate max-w-[400px]">{targetDetails}</span>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-50">

      <Card className="min-w-96 p-8 flex flex-col gap-4 shadow-lg">
        <h1 className="text-center font-bold text-2xl">Welcome to AETURA</h1>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-slate-600">Enter a URL</label>
          <Input ref={URL} placeholder="Enter URL" defaultValue="https://starzz.dev/" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-slate-600">Enter an intent prompt</label>
          <Input ref={INTENT} placeholder="Enter intent" defaultValue="go to the blog section and go the tura blog and then scroll down a little little until we reach the end of the page then click on the like button." />
        </div>

        <div className="">
          <Button variant="outline" className="w-full mb-2" onClick={handleClick}>Ping Server</Button>
          <Button variant="outline" className="w-1/2 " onClick={handleLoadMock}>
            Load Dev Cache
          </Button>
          <Button className="w-full" onClick={handleClick2} disabled={loading || isRecording}>
            {loading && !isPathBroken ? "Auditing Site..." : "Start Mapping"}
          </Button>
        </div>
      </Card>

      {/* Script Tree UI */}
      {scriptData && (
        <Card className="w-full max-w-2xl mt-8 p-6 shadow-md border-t-4 border-t-black">
          <h2 className="font-bold text-xl mb-1">Generated Script</h2>
          <p className="text-sm text-slate-500 mb-6">Goal: {scriptData.goal}</p>

          <div className="flex flex-col gap-4">
            {scriptData.steps.map((step, index) => (
              <div key={index} className="border p-4 rounded-md shadow-sm bg-white">

                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      Step {step.step_number}
                    </span>
                    {renderStepDescription(step)}
                  </div>

                  <Button
                    variant={editingStepIndex === index ? "destructive" : "secondary"}
                    size="sm"
                    onClick={() => setEditingStepIndex(editingStepIndex === index ? null : index)}
                    disabled={isRecording}
                  >
                    {editingStepIndex === index ? "Cancel" : "Edit"}
                  </Button>
                </div>

                {editingStepIndex === index && (
                  <div className="mt-4 p-4 bg-slate-100 rounded-md border border-slate-200">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">
                      Warning: Changing this deletes future steps!
                    </p>
                    <select
                      className="w-full p-2 border rounded-md text-sm bg-white"
                      value={step.action_taken.arguments?.element_id || ""}
                      onChange={(e) => handleElementChange(index, e.target.value)}
                    >
                      <option value="" disabled>Select a new target...</option>
                      {step.available_elements.map((el) => (
                        <option key={el.element_id} value={el.element_id}>
                          [ID: {el.element_id}] {el.text} {el.href ? `(Goes to ${el.href})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              </div>
            ))}
          </div>

          {isPathBroken && (
            <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-md">
              <p className="text-orange-800 text-sm font-semibold mb-3">
                ⚠️ Path Diverged! You changed history. The AI needs to calculate the remaining steps.
              </p>
              <Button
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                onClick={handleResumeScript}
                disabled={loading || isRecording}
              >
                {loading ? "Re-calculating..." : "Generate Remaining Steps"}
              </Button>
            </div>
          )}

          {/* THE NEW RECORDING BUTTON & VIDEO PLAYER */}
          {!finalVideoUrl && (
            <Button
              className="w-full mt-8"
              size="lg"
              onClick={handleRecordScript}
              disabled={isPathBroken || loading || isRecording}
            >
              {isRecording ? "🎥 Filming Demo..." : "Confirm & Record Demo"}
            </Button>
          )}

          {finalVideoUrl && (
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <h3 className="text-green-800 font-bold mb-4 text-xl">🎉 Your AI Demo is Ready!</h3>
              <video
                src={finalVideoUrl}
                controls
                autoPlay
                className="w-full rounded-md shadow-lg border border-slate-300"
              />
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => setFinalVideoUrl(null)}
              >
                Clear Video & Edit Script
              </Button>
            </div>
          )}

        </Card>
      )}

    </div>
  );
}

export default App;
