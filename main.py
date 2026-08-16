"""Run the referral intake graph."""

from pprint import pprint

from referral_intake.graph import build_graph
from referral_intake.runtime import GraphContext

PDF_PATH = "referral_packet.pdf"


def main() -> None:
    graph = build_graph()
    context = GraphContext()
    final_state: dict[str, object] | None = None

    for part in graph.stream(
        {"pdf_path": PDF_PATH},
        context=context,
        stream_mode=["updates", "values"],
        version="v2",
    ):
        if part["type"] == "updates":
            for node_name, update in part["data"].items():
                print(f"\nCompleted node: {node_name}")
                pprint(update)
        elif part["type"] == "values":
            final_state = part["data"]

    print("\nFinal graph state:")
    pprint(final_state)


if __name__ == "__main__":
    main()
