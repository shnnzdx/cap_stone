from __future__ import annotations

import pytest

from app.agents import chat as chat_agent
from app.domain.chat.service import _looks_like_change_request


def _user(text: str) -> chat_agent.HistoryTurn:
    return chat_agent.HistoryTurn(role="user", text=text)


def _assistant(text: str) -> chat_agent.HistoryTurn:
    return chat_agent.HistoryTurn(role="assistant", text=text)


@pytest.mark.parametrize(
    "message",
    [
        "可以放到晚上去吗？",
        "能不能挪到周四",
        "把周三的 Art Institute 改到下午 3 点",
        "这个可以提前一点吗",
        "周三排得太满了，能不能松一点",
        "can we move this to the evening?",
        "reschedule it to later",
    ],
)
def test_change_requests_are_routed_to_the_change_path(message: str):
    assert _looks_like_change_request(message) is True


@pytest.mark.parametrize(
    "message",
    [
        "给我介绍一下这个museum",
        "周三下午有什么安排",
        "这个博物馆多少钱",
        "what is on Wednesday",
    ],
)
def test_plain_questions_stay_on_the_question_path(message: str):
    assert _looks_like_change_request(message) is False


def test_bare_ok_inherits_the_intent_of_the_last_user_turn():
    history = (
        _user("可以放到晚上去吗？"),
        _assistant("I can check if moving it to the evening works. Shall I?"),
    )

    assert _looks_like_change_request("ok", history) is True


def test_bare_ok_after_a_plain_question_does_not_become_a_change_request():
    history = (
        _user("给我介绍一下这个museum"),
        _assistant("Field Museum is a natural history museum."),
    )

    assert _looks_like_change_request("ok", history) is False


def test_handing_the_choice_back_to_us_inherits_the_earlier_change_request():
    history = (
        _user("replace Lula Cafe with another place downtown"),
        _assistant("Do you want a specific place?"),
        _user("你选个在密歇根大道的咖啡店"),
    )

    assert _looks_like_change_request("随便", history) is True


def test_assistant_wording_alone_never_triggers_the_change_path():
    """The assistant used to be able to trigger the change path with its own
    reply, because history was matched without checking the role."""
    history = (
        _user("给我介绍一下这个museum"),
        _assistant("I could move or reschedule this for you if you want."),
    )

    assert _looks_like_change_request("thanks", history) is False
