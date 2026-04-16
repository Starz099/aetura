import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Separator,
} from "@/components/ui";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { apiClient, type DemoScript, type Step } from "@/services/api";

function Home() {
  const navigate = useNavigate();
  const urlRef = useRef<HTMLInputElement>(null);
  const intentRef = useRef<HTMLInputElement>(null);
  const startMappingInFlightRef = useRef(false);
  const resumeInFlightRef = useRef(false);
  const recordInFlightRef = useRef(false);

  const [scriptData, setScriptData] = useState<DemoScript | null>(null);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPathBroken, setIsPathBroken] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const grokApiKeys = useSettingsStore((state) => state.grokApiKeys);
  const recordingSettings = useSettingsStore(
    (state) => state.recordingSettings,
  );

  const handleClick2 = async () => {
    if (startMappingInFlightRef.current) return;

    try {
      if (!urlRef.current || !intentRef.current) return;
      if (grokApiKeys.length === 0) {
        alert("Add a Grok API key in Settings before starting mapping.");
        return;
      }

      startMappingInFlightRef.current = true;
      setLoading(true);
      setIsPathBroken(false);
      setFinalVideoUrl(null);

      const scriptData = await apiClient.draftScript({
        url: urlRef.current.value,
        intent: intentRef.current.value,
        grok_api_key: grokApiKeys[0],
      });

      setScriptData(scriptData);
    } catch (error) {
      console.error("Error starting mapping:", error);
      alert("Failed to start mapping. Check console for details.");
    } finally {
      startMappingInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleResumeScript = async () => {
    if (resumeInFlightRef.current || loading) return;
    if (!scriptData) return;
    if (grokApiKeys.length === 0) {
      alert("Add a Grok API key in Settings before resuming mapping.");
      return;
    }

    resumeInFlightRef.current = true;
    setLoading(true);
    try {
      const updatedScript = await apiClient.resumeScript({
        url: scriptData.starting_url,
        intent: scriptData.goal,
        approved_steps: scriptData.steps,
        grok_api_key: grokApiKeys[0],
      });

      setScriptData(updatedScript);
      setIsPathBroken(false);
    } catch (error) {
      console.error("Error resuming script:", error);
      alert("Failed to resume script. Check console for details.");
    } finally {
      resumeInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleRecordScript = async () => {
    if (recordInFlightRef.current || isRecording) return;
    if (!scriptData) return;

    recordInFlightRef.current = true;
    setIsRecording(true);
    setFinalVideoUrl(null);

    try {
      const response = await apiClient.recordVideo({
        url: scriptData.starting_url,
        approved_steps: scriptData.steps,
        recording_settings: {
          capture_fps: recordingSettings.captureFps,
          viewport_width: recordingSettings.viewportWidth,
          viewport_height: recordingSettings.viewportHeight,
          output_preset: recordingSettings.outputPreset,
        },
      });

      if (response.status === "success" && response.video_url) {
        setFinalVideoUrl(response.video_url);
      }
      console.log("Recording response:", response);
    } catch (error) {
      console.error("Error recording video:", error);
      alert("Failed to record video. Check console for details.");
    } finally {
      recordInFlightRef.current = false;
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

      const actualScriptData: DemoScript = rawData.agent_message
        ? rawData.agent_message
        : rawData;
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
      (el) => el.element_id === parseInt(newElementId),
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
          <Badge variant="secondary">Edited</Badge>
          <span className="text-sm font-medium">
            {description.replace("Swapped target to: ", "")}
          </span>
        </div>
      );
    }

    const formattedTool = tool_name.split("_")[0].toUpperCase();
    let targetDetails = "";

    if (tool_name === "click_element" || tool_name === "hover_element") {
      const targetElement = step.available_elements.find(
        (el: any) => el.element_id === args?.element_id,
      );
      targetDetails = targetElement
        ? `"${targetElement.text}"`
        : `Element ID: ${args?.element_id}`;
    } else if (tool_name === "goto_url") {
      targetDetails = args?.url || "";
    } else if (tool_name === "type_text") {
      const targetElement = step.available_elements.find(
        (el: any) => el.element_id === args?.element_id,
      );
      const elName = targetElement
        ? `"${targetElement.text}"`
        : `ID ${args?.element_id}`;
      targetDetails = `Typed "${args?.text}" into ${elName}`;
    } else if (tool_name === "scroll_page") {
      targetDetails = `Direction: ${args?.direction || "down"}`;
    } else if (tool_name === "finish_task") {
      targetDetails = "Goal accomplished!";
      return (
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="default">Finish</Badge>
          <span className="text-sm font-medium truncate">{targetDetails}</span>
        </div>
      );
    }

    let badgeVariant: "default" | "secondary" | "outline" = "outline";
    if (formattedTool === "CLICK") badgeVariant = "default";
    if (formattedTool === "HOVER") badgeVariant = "secondary";
    if (formattedTool === "GOTO") badgeVariant = "default";
    if (formattedTool === "TYPE") badgeVariant = "secondary";

    return (
      <div className="flex items-center gap-2 mt-1">
        <Badge variant={badgeVariant}>{formattedTool}</Badge>
        <span className="text-sm font-medium truncate">{targetDetails}</span>
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col gap-5 overflow-y-auto px-4 py-8 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Home</h1>
        </div>
      </div>

      {!scriptData && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base">Welcome to AETURA</CardTitle>
            <CardDescription>
              Use this workspace to generate, record, and edit a demo flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="url-input">Enter a URL</Label>
              <Input
                id="url-input"
                ref={urlRef}
                placeholder="Enter URL"
                defaultValue="https://starzz.dev/"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="intent-input">Enter an intent prompt</Label>
              <Input
                id="intent-input"
                ref={intentRef}
                placeholder="Enter intent"
                defaultValue="go to the blog section and go the tura blog and then scroll down a little little until we reach the end of the page then click on the like button."
              />
            </div>

            <Button variant="outline" onClick={handleLoadMock}>
              Load Dev Cache
            </Button>

            <Button onClick={handleClick2} disabled={loading || isRecording}>
              {loading && !isPathBroken ? "Auditing Site..." : "Start Mapping"}
            </Button>
          </CardContent>
        </Card>
      )}

      {scriptData && (
        <Card
          className={`mt-6 flex w-full min-h-0 flex-col ${
            finalVideoUrl ? "" : "max-h-[60vh]"
          }`}
        >
          {!finalVideoUrl && (
            <CardHeader>
              <CardTitle className="text-base">Generated Script</CardTitle>
              <CardDescription>Goal: {scriptData.goal}</CardDescription>
            </CardHeader>
          )}
          {!finalVideoUrl && (
            <>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
                {scriptData.steps.map((step, index) => (
                  <div key={index} className="rounded-md border bg-card p-3">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                          Step {step.step_number}
                        </span>
                        {renderStepDescription(step)}
                      </div>

                      <Button
                        variant={
                          editingStepIndex === index
                            ? "destructive"
                            : "secondary"
                        }
                        size="sm"
                        onClick={() =>
                          setEditingStepIndex(
                            editingStepIndex === index ? null : index,
                          )
                        }
                        disabled={isRecording}
                      >
                        {editingStepIndex === index ? "Cancel" : "Edit"}
                      </Button>
                    </div>

                    {editingStepIndex === index && (
                      <div className="mt-3 rounded-md border bg-muted p-3">
                        <p className="mb-2 text-xs font-semibold text-destructive uppercase tracking-wider">
                          Warning: Changing this deletes future steps!
                        </p>
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                          value={step.action_taken.arguments?.element_id || ""}
                          onChange={(e) =>
                            handleElementChange(index, e.target.value)
                          }
                        >
                          <option value="" disabled>
                            Select a new target...
                          </option>
                          {step.available_elements.map((el) => (
                            <option key={el.element_id} value={el.element_id}>
                              [ID: {el.element_id}] {el.text}{" "}
                              {el.href ? `(Goes to ${el.href})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>

              <Separator />

              {isPathBroken && (
                <div className="mx-4 mt-4 rounded-md border bg-muted p-3">
                  <p className="mb-3 text-sm font-semibold">
                    Path diverged. You changed history and the AI needs to
                    recalculate remaining steps.
                  </p>
                  <Button
                    className="w-full"
                    onClick={handleResumeScript}
                    disabled={loading || isRecording}
                  >
                    {loading ? "Re-calculating..." : "Generate Remaining Steps"}
                  </Button>
                </div>
              )}

              <Button
                className="mx-4 mt-4"
                size="lg"
                onClick={handleRecordScript}
                disabled={isPathBroken || loading || isRecording}
              >
                {isRecording ? "Recording Demo..." : "Confirm & Record Demo"}
              </Button>
            </>
          )}

          {finalVideoUrl && (
            <CardContent className="p-4 sm:p-5">
              <div className="rounded-md border bg-muted p-4 text-center">
                <h3 className="mb-3 text-base font-semibold">
                  Your AI demo is ready
                </h3>
                <div className="overflow-hidden rounded-md border bg-black/85">
                  <video
                    src={finalVideoUrl}
                    controls
                    autoPlay
                    muted
                    playsInline
                    className="aspect-video max-h-[68vh] w-full object-contain"
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    onClick={() =>
                      navigate(`/editor/${encodeURIComponent(finalVideoUrl)}`)
                    }
                  >
                    Open in Editor
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setFinalVideoUrl(null)}
                  >
                    View Script Again
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

export default Home;
