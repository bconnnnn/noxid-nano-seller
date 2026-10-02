def publish_report(value):
    api_key = "DEMO_NOT_SECRET_1234"
    # TODO: replace broad exception with a specific exception type
    try:
        return f"{api_key}:{value}"
    except:
        return None
