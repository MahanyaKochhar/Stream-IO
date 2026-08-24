"""Run the referral intake graph."""

from pprint import pprint
from uuid import uuid4

from langgraph.types import Command

from referral_intake.graph import build_graph
from referral_intake.persistence import postgres_checkpointer
from referral_intake.runtime import GraphContext

PDF_PATH = "referral_packet.pdf"


def main() -> None:
    context = GraphContext()
    config = {"configurable": {"thread_id": str(uuid4())}}
    final_state: dict[str, object] | None = None
    graph_input: dict[str, str] | Command = {"pdf_path": PDF_PATH}

    print(f"Thread ID: {config['configurable']['thread_id']}")
    with postgres_checkpointer() as checkpointer:
        graph = build_graph(checkpointer=checkpointer)
        while True:
            review_request: object | None = None
            for part in graph.stream(
                graph_input,
                config=config,
                context=context,
                stream_mode=["updates", "values"],
                subgraphs=True,
                version="v2",
            ):
                if part["type"] == "updates":
                    if "__interrupt__" in part["data"]:
                        review_request = part["data"]["__interrupt__"][0].value
                        continue
                    for node_name, update in part["data"].items():
                        print(f"\nCompleted node: {node_name}")
                        pprint(update)
                elif part["type"] == "values":
                    final_state = part["data"]

            if review_request is None:
                break

            print("\nHuman review required:")
            pprint(review_request)
            if isinstance(review_request, dict) and "options" in review_request:
                options = review_request["options"]
                decision = ""
                while decision not in options:
                    decision = (
                        input(f"Decision ({'/'.join(options)}): ").strip().lower()
                    )
                graph_input = Command(resume=decision)
            else:
                review_text = ""
                while not review_text:
                    review_text = input("Review text: ").strip()
                graph_input = Command(resume=review_text)

    print("\nFinal graph state:")
    pprint(final_state)


if __name__ == "__main__":
    main()
