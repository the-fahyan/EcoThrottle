import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App smoke test", () => {
  it("renders GreenShift branding and dashboard shell", () => {
    render(<App />);
    expect(screen.getByText("GreenShift")).toBeInTheDocument();
    expect(screen.getByText("Current Grid Intensity")).toBeInTheDocument();
    expect(screen.getByText("Active Workloads")).toBeInTheDocument();
  });
});
