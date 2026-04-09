import { Link } from "react-router-dom";

const index = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-4">
      AETURA NAVBAR
      <Link to="/">Home</Link>
      <Link to="/recordings">Recordings</Link>
      <Link to="/editor">Editor</Link>
    </div>
  );
};

export default index;
