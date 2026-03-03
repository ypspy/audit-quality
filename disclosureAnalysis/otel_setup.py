import os

try:
  from opentelemetry import metrics, trace
  from opentelemetry.exporter.otlp.proto.http.metric_exporter import (
    OTLPMetricExporter,
  )
  from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
    OTLPSpanExporter,
  )
  from opentelemetry.sdk.metrics import MeterProvider
  from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
  from opentelemetry.sdk.resources import Resource
  from opentelemetry.sdk.trace import TracerProvider
  from opentelemetry.sdk.trace.export import BatchSpanProcessor
  from opentelemetry.instrumentation.logging import LoggingInstrumentation
except ImportError:  # 런타임에 OTEL이 없으면 조용히 패스
  trace = None
  metrics = None


_INITIALIZED = False


def setup_otel() -> None:
  """
  OTLP(HTTP) 기반 OpenTelemetry 설정.
  OTEL_EXPORTER_OTLP_ENDPOINT 환경변수가 없으면 아무 것도 하지 않는다.
  """
  global _INITIALIZED
  if _INITIALIZED or trace is None or metrics is None:
    return

  endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
  if not endpoint:
    return

  service_name = os.getenv("OTEL_SERVICE_NAME", "disclosure-analysis")

  resource = Resource.create({"service.name": service_name})

  # Traces
  span_exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
  tracer_provider = TracerProvider(resource=resource)
  tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
  trace.set_tracer_provider(tracer_provider)

  # Metrics
  metric_exporter = OTLPMetricExporter(endpoint=endpoint, insecure=True)
  reader = PeriodicExportingMetricReader(metric_exporter)
  meter_provider = MeterProvider(resource=resource, metric_readers=[reader])
  metrics.set_meter_provider(meter_provider)

  # Logs → OTEL 파이프라인 (logging 모듈 기반)
  LoggingInstrumentation().instrument(set_logging_format=True)

  _INITIALIZED = True


# import 시점에 한 번만 초기화 시도
setup_otel()

