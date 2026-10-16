import { useEffect, useState } from "react";
import { api } from "../services/api";
export function useResource(path, revision = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: "" });
    const timer = setTimeout(() => {
      api(path)
        .then((data) => active && setState({ data, loading: false, error: "" }))
        .catch(
          (error) =>
            active &&
            setState({ data: null, loading: false, error: error.message }),
        );
    }, 160);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [path, revision]);
  return state;
}
