"""LangChain healthcare chat agent with one referral intake tool."""

import json

from langchain.agents import create_agent
from langchain.tools import ToolRuntime, tool
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.stream import CustomTransformer
from pydantic_core import to_jsonable_python

from referral_intake.dependencies import GraphDependencies
from referral_intake.graph import build_graph

SYSTEM_PROMPT = """
# Role:
You are Stream, a healthcare AI agent for patient referral and healthcare flows.
Do not infer a task from context alone. If the user has not stated a task,
ask what they want to do before using a tool.

# Available tools:
referral_intake processes an attached referral PDF.
Use its result already in the conversation for later questions about that referral.
After it completes, respond naturally in short plain prose. Do not use a table or
repeat extracted details unless the user asks.

This is your only capability for now.
""".strip()


def build_stream_agent(
    dependencies: GraphDependencies,
    model: BaseChatModel,
    checkpointer: BaseCheckpointSaver | None = None,
):
    """Create stream_agent with intake as its only tool."""

    intake = build_graph(dependencies)

    @tool(response_format="content_and_artifact")
    def referral_intake(runtime: ToolRuntime) -> tuple[str, dict]:
        """Process the attached referral PDF.

        Reads the PDF reference from the conversation and pauses for review
        when the intake workflow requires it.
        """

        referral = next(
            (
                message.additional_kwargs["referral"]
                for message in reversed(runtime.state["messages"])
                if isinstance(message, HumanMessage)
                and message.additional_kwargs.get("referral")
            ),
            {},
        )

        if not referral.get("pdf_path"):
            return "Ask the user to attach a referral PDF before starting intake.", {}

        result = {}
        for values in intake.stream(
            referral,
            config=runtime.config,
            stream_mode="values",
        ):
            result = {key: value for key, value in values.items() if key != "markdown"}
            runtime.stream_writer({"type": "referral_state", "referral": result})

        return json.dumps(to_jsonable_python(result), separators=(",", ":")), result

    return create_agent(
        model,
        tools=[referral_intake],
        system_prompt=SYSTEM_PROMPT,
        checkpointer=checkpointer,
        transformers=[CustomTransformer],
        name="stream_agent",
    )
