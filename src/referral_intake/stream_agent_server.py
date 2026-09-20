"""Serve the LangChain stream_agent through Agent Server."""

from referral_intake.dependencies import GraphDependencies
from referral_intake.llm_navigator import navigator_model
from referral_intake.stream_agent import build_stream_agent

stream_agent = build_stream_agent(GraphDependencies(), navigator_model())
