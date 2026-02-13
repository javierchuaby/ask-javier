/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogoutModal } from "./LogoutModal";

describe("LogoutModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <LogoutModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal content when open", () => {
    render(<LogoutModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /log out/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/are you sure you want to log out/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /log out/i }),
    ).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<LogoutModal isOpen={true} onClose={onClose} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Log out is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <LogoutModal isOpen={true} onClose={vi.fn()} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
