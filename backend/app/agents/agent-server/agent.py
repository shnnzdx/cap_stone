from ollama import chat


# --------------------------------
# TOOL
# --------------------------------

def classify_change(item: str, new_time: str) -> str:
    """
    Check how a requested itinerary change should be handled.

    Args:
        item: The itinerary item the user wants to change.
        new_time: The requested new time.

    Returns:
        NOTICE, ROUND, or CONFIRM.
    """

    item_lower = item.lower()
    time_lower = new_time.lower()

    # Demo rule: booked dinner
    if "birthday dinner" in item_lower:
        return (
            "CONFIRM: This activity has a confirmed booking. "
            "The Current Plan must stay unchanged until affected members confirm."
        )

    # Demo rule: required constraint
    if "8" in time_lower and (
        "am" in time_lower or "morning" in time_lower
    ):
        return (
            "CONFIRM: The requested time violates one member's "
            "required constraint. Do not reveal the member's identity "
            "or private reason."
        )

    # Demo rule: contested slot
    if "4" in time_lower and (
        "pm" in time_lower or "afternoon" in time_lower
    ):
        return (
            "ROUND: This time slot already has a competing suggestion. "
            "Open a group decision round instead of overwriting "
            "the Current Plan."
        )

    return (
        "NOTICE: No hard constraint, confirmed booking, or existing "
        "conflict was found. This change can be applied and the group "
        "can be notified."
    )


# --------------------------------
# AGENT
# --------------------------------

SYSTEM_PROMPT = """
You are TripSync Coordinator, an AI agent for collaborative group travel.

When a user wants to change an itinerary item:

1. ALWAYS use classify_change before answering.
2. Never guess whether the change is safe.
3. Follow the tool result.
4. NOTICE means the change can be applied directly.
5. ROUND means the group should decide.
6. CONFIRM means affected members must confirm first.
7. Never reveal private member information.
8. NEVER claim that the Current Plan has already been changed.
9. You only analyze and recommend a route. The user must click the action button before any change is applied.

Keep your final answer short and clear.
"""


def run_agent(message: str):

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": message,
        },
    ]

    response = chat(
        model="qwen3.5:4b",
        messages=messages,
        tools=[classify_change],
        think=False,
    )

    messages.append(response.message)

    # 如果模型没有调用工具
    if not response.message.tool_calls:
        return {
            "reply": response.message.content,
            "path": None,
            "tool": None,
        }

    tool_info = None

    for tool_call in response.message.tool_calls:

        if tool_call.function.name == "classify_change":

            args = tool_call.function.arguments

            result = classify_change(**args)

            # NOTICE / ROUND / CONFIRM
            path = result.split(":")[0]

            tool_info = {
                "name": "classify_change",
                "arguments": args,
                "result": result,
            }

            messages.append(
                {
                    "role": "tool",
                    "tool_name": tool_call.function.name,
                    "content": result,
                }
            )

    final_response = chat(
        model="qwen3.5:4b",
        messages=messages,
        tools=[classify_change],
        think=False,
    )

    return {
        "reply": final_response.message.content,
        "path": path,
        "tool": tool_info,
    }