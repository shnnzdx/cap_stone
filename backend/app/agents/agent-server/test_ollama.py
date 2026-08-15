from ollama import chat


# -----------------------------
# Tool 1: classify_change
# -----------------------------
def classify_change(item: str, new_time: str) -> str:
    """
    Check how a requested itinerary time change should be handled.

    Args:
        item: The itinerary item the user wants to change.
        new_time: The new requested time.

    Returns:
        The decision path: NOTICE, ROUND, or CONFIRM.
    """

    item_lower = item.lower()
    time_lower = new_time.lower()

    # DEMO RULE 1:
    # Birthday dinner is already booked.
    if "birthday dinner" in item_lower:
        return (
            "CONFIRM: This activity has a confirmed booking. "
            "The Current Plan must stay unchanged until affected members confirm."
        )

    # DEMO RULE 2:
    # 8 AM conflicts with one member's required constraint.
    if "8" in time_lower and ("am" in time_lower or "morning" in time_lower):
        return (
            "CONFIRM: The requested time violates one member's required constraint. "
            "Do not reveal the member's identity or private reason."
        )

    # DEMO RULE 3:
    # 4 PM represents an already-contested slot for classroom demo.
    if "4" in time_lower and ("pm" in time_lower or "afternoon" in time_lower):
        return (
            "ROUND: This time slot already has a competing suggestion. "
            "Open a group decision round instead of overwriting the Current Plan."
        )

    # Everything else is safe.
    return (
        "NOTICE: No hard constraint, confirmed booking, or existing conflict was found. "
        "This change can be applied and the group can be notified."
    )


# -----------------------------
# TripSync Agent
# -----------------------------

messages = [
    {
        "role": "system",
        "content": """
You are TripSync Coordinator, an AI agent for collaborative group travel.

When a user wants to change an itinerary item:

1. ALWAYS use the classify_change tool before giving an answer.
2. Never guess whether a change is safe.
3. Follow the tool result.
4. NOTICE means the change can be applied directly.
5. ROUND means the group should decide between competing options.
6. CONFIRM means affected members must confirm before the Current Plan changes.
7. Never reveal private member information.

Keep the final answer short and clear.
""",
    },
    {
        "role": "user",
        "content": "Can we move the Art Institute to 3:30 PM?",
    },
]


# First: let AI decide whether to use the tool
response = chat(
    model="qwen3.5:4b",
    messages=messages,
    tools=[classify_change],
    think=False,
)

messages.append(response.message)


# If AI requested the tool, actually run it
if response.message.tool_calls:

    for tool_call in response.message.tool_calls:

        print("\n--- AGENT TOOL ACTIVITY ---")
        print("Tool:", tool_call.function.name)
        print("Arguments:", tool_call.function.arguments)

        if tool_call.function.name == "classify_change":

            result = classify_change(
                **tool_call.function.arguments
            )

            print("Tool result:", result)

            # Give the tool result back to the AI
            messages.append(
                {
                    "role": "tool",
                    "tool_name": tool_call.function.name,
                    "content": result,
                }
            )

    # Ask AI to answer using the real tool result
    final_response = chat(
        model="qwen3.5:4b",
        messages=messages,
        tools=[classify_change],
        think=False,
    )

    print("\n--- TRIPSYNC AGENT ---")
    print(final_response.message.content)

else:

    print("\nWARNING: The model did not call the tool.")
    print(response.message.content)
    