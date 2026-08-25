"""LangGraph Agent Server entry point."""

from referral_intake.dependencies import GraphDependencies
from referral_intake.graph import build_graph

dependencies = GraphDependencies()
graph = build_graph(dependencies)
